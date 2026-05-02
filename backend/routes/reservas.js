import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";
const OPEN_MATCH_MAX_PLAYERS = 4;

// Middleware opcional: permite enriquecer la respuesta si el usuario esta logueado.
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

function selectColumn(columns, expression, fallback, alias) {
  return columns.has(alias) ? expression : `${fallback} AS ${alias}`;
}

function normalizeLevel(value) {
  if (value === "" || value === null || value === undefined) return null;
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= 6 ? level : null;
}

async function getAlumnoForUser(userId) {
  const alumnosColumns = await getTableColumns("alumnos");
  if (!alumnosColumns.has("usuario_id")) return null;

  const selects = [
    "id",
    "nombre",
    "apellidos",
    alumnosColumns.has("nivel_juego") ? "nivel_juego" : "NULL AS nivel_juego",
  ];

  const [rows] = await query(
    `SELECT ${selects.join(", ")} FROM alumnos WHERE usuario_id = ? LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function getUserGameLevel(user) {
  const usuarioColumns = await getTableColumns("usuarios");
  let userLevel = null;

  if (usuarioColumns.has("nivel_juego")) {
    const [users] = await query("SELECT nivel_juego FROM usuarios WHERE id = ? LIMIT 1", [user.id]);
    userLevel = normalizeLevel(users[0]?.nivel_juego);
  }

  if (userLevel !== null) return userLevel;

  const alumno = await getAlumnoForUser(user.id);
  return normalizeLevel(alumno?.nivel_juego);
}

function canJoinReservation(reserva, user, userLevel, userParticipant) {
  if (!user) return { puede_unirse: false, motivo_no_unirse: "Debes iniciar sesion para unirte." };
  if (reserva.tipo_reserva !== "abierta") return { puede_unirse: false, motivo_no_unirse: "No es una partida abierta." };
  if (reserva.estado === "cancelada") return { puede_unirse: false, motivo_no_unirse: "La partida esta cancelada." };
  if (userParticipant) return { puede_unirse: false, motivo_no_unirse: "Ya estas en esta partida." };
  if (Number(reserva.plazas_ocupadas || 0) >= Number(reserva.max_jugadores || OPEN_MATCH_MAX_PLAYERS)) {
    return { puede_unirse: false, motivo_no_unirse: "Partida completa." };
  }
  if (userLevel === null) return { puede_unirse: false, motivo_no_unirse: "Configura tu nivel de juego antes de unirte." };
  if (reserva.nivel_min !== null && userLevel < Number(reserva.nivel_min)) {
    return { puede_unirse: false, motivo_no_unirse: "Tu nivel no coincide con esta partida." };
  }
  if (reserva.nivel_max !== null && userLevel > Number(reserva.nivel_max)) {
    return { puede_unirse: false, motivo_no_unirse: "Tu nivel no coincide con esta partida." };
  }

  return { puede_unirse: true, motivo_no_unirse: null };
}

async function getParticipantsByReservation(reservaIds) {
  if (!reservaIds.length || !(await tableExists("reservas_pista_participantes"))) {
    return new Map();
  }

  const usuarioColumns = await getTableColumns("usuarios");
  const alumnoColumns = await getTableColumns("alumnos");
  const usuarioField = (field) => (usuarioColumns.has(field) ? `u.${field}` : "NULL");
  const alumnoField = (field) => (alumnoColumns.has(field) ? `a.${field}` : "NULL");

  const [rows] = await query(
    `SELECT
      rp.reserva_id,
      rp.usuario_id,
      rp.alumno_id,
      rp.estado,
      rp.es_creador,
      COALESCE(${alumnoField("nombre")}, ${usuarioField("nombre")}, 'Jugador') AS nombre,
      COALESCE(${alumnoField("apellidos")}, ${usuarioField("apellidos")}) AS apellidos,
      COALESCE(${alumnoField("foto_perfil_url")}, ${usuarioField("foto_perfil_url")}) AS foto_perfil_url,
      COALESCE(${alumnoField("nivel_juego")}, ${usuarioField("nivel_juego")}) AS nivel_juego,
      COALESCE(${alumnoField("mano_dominante")}, ${usuarioField("mano_dominante")}) AS mano_dominante,
      COALESCE(${alumnoField("lado_preferido")}, ${usuarioField("lado_preferido")}) AS lado_preferido,
      COALESCE(${alumnoField("club_habitual")}, ${usuarioField("club_habitual")}) AS club_habitual
     FROM reservas_pista_participantes rp
     LEFT JOIN usuarios u ON u.id = rp.usuario_id
     LEFT JOIN alumnos a ON a.id = rp.alumno_id
     WHERE rp.reserva_id IN (${reservaIds.map(() => "?").join(", ")})
       AND rp.estado = 'confirmado'
     ORDER BY rp.es_creador DESC, rp.creado_en ASC`,
    reservaIds
  );

  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.reserva_id)) map.set(row.reserva_id, []);
    map.get(row.reserva_id).push(row);
  });
  return map;
}

async function updateOpenReservationState(connection, reservaId) {
  const [countRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM reservas_pista_participantes
     WHERE reserva_id = ? AND estado = 'confirmado'`,
    [reservaId]
  );
  const total = Number(countRows[0]?.total || 0);
  const [reservationRows] = await connection.query(
    "SELECT max_jugadores FROM reservas_pista WHERE id = ? LIMIT 1",
    [reservaId]
  );
  const maxPlayers = Number(reservationRows[0]?.max_jugadores || OPEN_MATCH_MAX_PLAYERS);
  const nextStatus = total === 0 ? "cancelada" : total >= maxPlayers ? "confirmada" : "abierta";

  await connection.query(
    "UPDATE reservas_pista SET estado = ? WHERE id = ?",
    [nextStatus, reservaId]
  );
  return total;
}

// GET /api/reservas?fecha=2026-03-30&pista_id=1
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { fecha, pista_id } = req.query;
    const reservaColumns = await getTableColumns("reservas_pista");
    const filters = [];
    const values = [];

    if (fecha) {
      filters.push("r.fecha = ?");
      values.push(fecha);
    }

    if (pista_id) {
      filters.push("r.pista_id = ?");
      values.push(pista_id);
    }

    filters.push("r.estado != 'cancelada'");
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await query(
      `SELECT
        r.id,
        ${selectColumn(reservaColumns, "r.alumno_id", "NULL", "alumno_id")},
        r.usuario_id,
        r.nombre_cliente,
        r.telefono_cliente,
        r.pista_id,
        p.nombre AS pista_nombre,
        r.fecha,
        r.hora_inicio,
        r.duracion_min,
        r.estado,
        ${selectColumn(reservaColumns, "r.tipo_reserva", "'completa'", "tipo_reserva")},
        ${selectColumn(reservaColumns, "r.max_jugadores", OPEN_MATCH_MAX_PLAYERS, "max_jugadores")},
        ${selectColumn(reservaColumns, "r.nivel_min", "NULL", "nivel_min")},
        ${selectColumn(reservaColumns, "r.nivel_max", "NULL", "nivel_max")},
        r.notas,
        r.creado_en
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       ${where}
       ORDER BY r.hora_inicio, r.pista_id`,
      values
    );

    const participantsMap = await getParticipantsByReservation(rows.map((row) => row.id));
    const userLevel = req.user ? await getUserGameLevel(req.user) : null;

    const reservas = rows.map((row) => {
      const participantes = participantsMap.get(row.id) || [];
      const userParticipant = req.user
        ? participantes.find((item) => String(item.usuario_id) === String(req.user.id))
        : null;
      const plazasOcupadas = row.tipo_reserva === "abierta" ? participantes.length : OPEN_MATCH_MAX_PLAYERS;
      const joinState = canJoinReservation({ ...row, plazas_ocupadas: plazasOcupadas }, req.user, userLevel, userParticipant);

      return {
        ...row,
        max_jugadores: Number(row.max_jugadores || OPEN_MATCH_MAX_PLAYERS),
        nivel_min: row.nivel_min === null ? null : Number(row.nivel_min),
        nivel_max: row.nivel_max === null ? null : Number(row.nivel_max),
        plazas_ocupadas: plazasOcupadas,
        participantes,
        ...joinState,
      };
    });

    res.json({ ok: true, reservas });
  } catch (e) {
    console.error("Error GET /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/reservas/pistas
router.get("/pistas", async (_req, res) => {
  try {
    const [rows] = await query("SELECT id, nombre FROM pistas WHERE activa = 1 ORDER BY id");
    res.json({ ok: true, pistas: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/reservas crea reserva completa o partida abierta.
router.post("/", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const reservaColumns = await getTableColumns("reservas_pista");
    const tipoReserva = req.body.tipo_reserva === "abierta" ? "abierta" : "completa";
    const { nombre_cliente, telefono_cliente, pista_id, fecha, hora_inicio, duracion_min, notas } = req.body;

    if (!pista_id || !fecha || !hora_inicio) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios (pista_id, fecha, hora_inicio)" });
    }

    if (tipoReserva === "abierta" && (!(await tableExists("reservas_pista_participantes")) || !reservaColumns.has("tipo_reserva"))) {
      return res.status(400).json({
        ok: false,
        message: "Falta aplicar la migracion de partidas abiertas en MySQL.",
      });
    }

    const nivelMin = normalizeLevel(req.body.nivel_min);
    const nivelMax = normalizeLevel(req.body.nivel_max);

    if (tipoReserva === "abierta") {
      if (nivelMin === null || nivelMax === null || nivelMin > nivelMax) {
        return res.status(400).json({ ok: false, message: "Selecciona un rango de nivel valido." });
      }
      const userLevel = await getUserGameLevel(req.user);
      if (userLevel === null) {
        return res.status(400).json({ ok: false, message: "Configura tu nivel de juego antes de crear una partida abierta." });
      }
      if (userLevel < nivelMin || userLevel > nivelMax) {
        return res.status(400).json({ ok: false, message: "Tu nivel debe estar dentro del rango de la partida." });
      }
    }

    await connection.beginTransaction();

    // Bloquea el hueco de pista para evitar dos reservas simultaneas en la misma hora.
    const [existing] = await connection.query(
      `SELECT id FROM reservas_pista
       WHERE pista_id = ? AND fecha = ? AND hora_inicio = ? AND estado != 'cancelada'
       FOR UPDATE`,
      [pista_id, fecha, hora_inicio]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Esa pista ya esta reservada en esa fecha y hora" });
    }

    const [userReservas] = await connection.query(
      `SELECT id FROM reservas_pista
       WHERE usuario_id = ? AND fecha = ? AND estado != 'cancelada'
       FOR UPDATE`,
      [req.user.id, fecha]
    );

    if (userReservas.length > 0) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Ya tienes una reserva para este dia. Solo se permite una reserva por dia." });
    }

    const payload = {
      alumno_id: null,
      usuario_id: req.user.id,
      nombre_cliente: nombre_cliente || req.user.nombre,
      telefono_cliente: telefono_cliente || null,
      pista_id,
      fecha,
      hora_inicio,
      duracion_min: duracion_min || 90,
      tipo_reserva: tipoReserva,
      max_jugadores: OPEN_MATCH_MAX_PLAYERS,
      nivel_min: tipoReserva === "abierta" ? nivelMin : null,
      nivel_max: tipoReserva === "abierta" ? nivelMax : null,
      estado: tipoReserva === "abierta" ? "abierta" : "confirmada",
      notas: notas || null,
    };

    const fields = Object.keys(payload).filter((field) => reservaColumns.has(field));
    const [result] = await connection.query(
      `INSERT INTO reservas_pista (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      fields.map((field) => payload[field])
    );

    if (tipoReserva === "abierta") {
      const alumno = await getAlumnoForUser(req.user.id);
      await connection.query(
        `INSERT INTO reservas_pista_participantes
          (reserva_id, usuario_id, alumno_id, estado, es_creador)
         VALUES (?, ?, ?, 'confirmado', 1)`,
        [result.insertId, req.user.id, alumno?.id || null]
      );
    }

    await connection.commit();

    res.status(201).json({
      ok: true,
      id: result.insertId,
      message: tipoReserva === "abierta" ? "Partida abierta creada correctamente" : "Reserva creada correctamente",
    });
  } catch (e) {
    await connection.rollback();
    console.error("Error POST /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// POST /api/reservas/:id/unirse
router.post("/:id/unirse", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, tipo_reserva, estado, max_jugadores, nivel_min, nivel_max
       FROM reservas_pista
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, message: "Reserva no encontrada" });
    }

    const reserva = rows[0];
    if (reserva.tipo_reserva !== "abierta" || reserva.estado === "cancelada") {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "No puedes unirte a esta reserva" });
    }

    const userLevel = await getUserGameLevel(req.user);
    if (userLevel === null) {
      await connection.rollback();
      return res.status(400).json({ ok: false, message: "Configura tu nivel de juego antes de unirte a partidas abiertas." });
    }

    if ((reserva.nivel_min !== null && userLevel < Number(reserva.nivel_min)) || (reserva.nivel_max !== null && userLevel > Number(reserva.nivel_max))) {
      await connection.rollback();
      return res.status(403).json({ ok: false, message: "Tu nivel no coincide con esta partida." });
    }

    const [already] = await connection.query(
      `SELECT id FROM reservas_pista_participantes
       WHERE reserva_id = ? AND usuario_id = ? AND estado = 'confirmado'
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    if (already.length > 0) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Ya estas en esta partida." });
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM reservas_pista_participantes
       WHERE reserva_id = ? AND estado = 'confirmado'`,
      [req.params.id]
    );

    if (Number(countRows[0]?.total || 0) >= Number(reserva.max_jugadores || OPEN_MATCH_MAX_PLAYERS)) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Partida completa." });
    }

    const alumno = await getAlumnoForUser(req.user.id);

    // Si el usuario habia cancelado antes, se reactiva; si no, se crea el participante.
    await connection.query(
      `INSERT INTO reservas_pista_participantes
        (reserva_id, usuario_id, alumno_id, estado, es_creador)
       VALUES (?, ?, ?, 'confirmado', 0)
       ON DUPLICATE KEY UPDATE estado = 'confirmado', alumno_id = VALUES(alumno_id)`,
      [req.params.id, req.user.id, alumno?.id || null]
    );

    const total = await updateOpenReservationState(connection, req.params.id);
    await connection.commit();

    res.json({ ok: true, plazas_ocupadas: total, message: "Te has unido a la partida" });
  } catch (e) {
    await connection.rollback();
    console.error("Error POST /api/reservas/:id/unirse:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/reservas/:id/participantes/me
router.delete("/:id/participantes/me", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, tipo_reserva, estado FROM reservas_pista WHERE id = ? FOR UPDATE",
      [req.params.id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, message: "Reserva no encontrada" });
    }

    if (rows[0].tipo_reserva !== "abierta") {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Solo puedes salirte de partidas abiertas." });
    }

    const [result] = await connection.query(
      `UPDATE reservas_pista_participantes
       SET estado = 'cancelado'
       WHERE reserva_id = ? AND usuario_id = ? AND estado = 'confirmado'`,
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, message: "No estas apuntado a esta partida." });
    }

    const total = await updateOpenReservationState(connection, req.params.id);
    await connection.commit();

    res.json({ ok: true, plazas_ocupadas: total, message: "Has salido de la partida" });
  } catch (e) {
    await connection.rollback();
    console.error("Error DELETE /api/reservas/:id/participantes/me:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// PATCH /api/reservas/:id/cancelar (solo el dueño o admin)
router.patch("/:id/cancelar", requireAuth, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT id, usuario_id FROM reservas_pista WHERE id = ? AND estado != 'cancelada'",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Reserva no encontrada" });
    }

    const reserva = rows[0];
    if (reserva.usuario_id !== req.user.id && req.user.rol !== "admin") {
      return res.status(403).json({ ok: false, message: "No puedes cancelar esta reserva" });
    }

    await query("UPDATE reservas_pista SET estado = 'cancelada' WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Reserva cancelada" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
