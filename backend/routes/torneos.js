import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/security.js";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const STAFF_ROLES = ["admin", "profesor", "profe"];

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

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Debes iniciar sesión" });
  }
  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." });
  }
}

function requireAdmin(req, res, next) {
  if (!STAFF_ROLES.includes(String(req.user?.rol || "").toLowerCase())) {
    return res.status(403).json({ ok: false, message: "No tienes permisos para esta acción" });
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

function alumnoNameSelect(columns, alias = "a") {
  const apellidos = columns.has("apellidos") ? `${alias}.apellidos` : "''";
  return `TRIM(CONCAT(COALESCE(${alias}.nombre, ''), ' ', COALESCE(${apellidos}, '')))`;
}

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalJson(value) {
  if (value === "" || value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function pushInsertField(columns, insertColumns, insertValues, field, value) {
  if (!columns.has(field)) return;
  insertColumns.push(field);
  insertValues.push(value);
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateRandomPairs(players) {
  const shuffled = shuffleArray(players);
  const reserve = shuffled.length % 2 === 1 ? shuffled.pop() : null;
  const pairs = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({ jugador1: shuffled[i], jugador2: shuffled[i + 1] });
  }

  return { pairs, reserve };
}

function normalizeEstadoPareja(value) {
  return ["activa", "baja", "reserva"].includes(value) ? value : "activa";
}

function normalizeIncidenciaTipo(value) {
  return ["horario", "pista", "lesion", "ausencia", "organizacion", "otro"].includes(value) ? value : "otro";
}

function normalizeIncidenciaEstado(value) {
  return ["abierta", "resuelta"].includes(value) ? value : "abierta";
}

async function fetchAmericanoDetail(americanoId) {
  const alumnoColumns = await getTableColumns("alumnos");
  const alumnoName = alumnoNameSelect(alumnoColumns);
  const alumnoActivoWhere = alumnoColumns.has("activo") ? "AND a.activo = 1" : "";
  const alumnoOrder = alumnoColumns.has("apellidos") ? "a.apellidos, a.nombre" : "a.nombre";

  const [americanos] = await query("SELECT * FROM torneos_americanos WHERE id = ? LIMIT 1", [americanoId]);
  if (!americanos.length) return null;

  const [participantes] = await query(
    `SELECT ap.id, ap.alumno_id, ${alumnoName} AS nombre, a.nivel, ${alumnoColumns.has("nivel_juego") ? "a.nivel_juego" : "NULL AS nivel_juego"}
     FROM americano_participantes ap
     JOIN alumnos a ON a.id = ap.alumno_id ${alumnoActivoWhere}
     WHERE ap.americano_id = ?
     ORDER BY ${alumnoOrder}`,
    [americanoId]
  );

  const [partidos] = await query(
    `SELECT
      p.*,
      ${alumnoNameSelect(alumnoColumns, "a1")} AS equipo_a_1,
      ${alumnoNameSelect(alumnoColumns, "a2")} AS equipo_a_2,
      ${alumnoNameSelect(alumnoColumns, "b1")} AS equipo_b_1,
      ${alumnoNameSelect(alumnoColumns, "b2")} AS equipo_b_2
     FROM americano_partidos p
     JOIN alumnos a1 ON a1.id = p.equipo_a_alumno_1_id
     LEFT JOIN alumnos a2 ON a2.id = p.equipo_a_alumno_2_id
     JOIN alumnos b1 ON b1.id = p.equipo_b_alumno_1_id
     LEFT JOIN alumnos b2 ON b2.id = p.equipo_b_alumno_2_id
     WHERE p.americano_id = ?
     ORDER BY COALESCE(p.ronda, 999), COALESCE(p.orden, 999), p.id`,
    [americanoId]
  );

  let parejas = [];
  let incidencias = [];

  if (await tableExists("americano_parejas")) {
    const [parejasRows] = await query(
      `SELECT
        p.*,
        COALESCE(p.jugador1_nombre, ${alumnoNameSelect(alumnoColumns, "a1")}) AS jugador1,
        COALESCE(p.jugador2_nombre, ${alumnoNameSelect(alumnoColumns, "a2")}) AS jugador2
       FROM americano_parejas p
       JOIN alumnos a1 ON a1.id = p.jugador1_alumno_id
       LEFT JOIN alumnos a2 ON a2.id = p.jugador2_alumno_id
       WHERE p.americano_id = ?
       ORDER BY p.estado = 'reserva', p.id`,
      [americanoId]
    );
    parejas = parejasRows;
  }

  if (await tableExists("americano_incidencias")) {
    const [incidenciaRows] = await query(
      `SELECT i.*
       FROM americano_incidencias i
       WHERE i.americano_id = ?
       ORDER BY i.estado = 'resuelta', i.created_at DESC, i.id DESC`,
      [americanoId]
    );
    incidencias = incidenciaRows;
  }

  const rankingMap = new Map(participantes.map((p) => [
    Number(p.alumno_id),
    { alumno_id: p.alumno_id, nombre: p.nombre, puntos: 0, partidos: 0, victorias: 0, diferencia: 0 },
  ]));

  partidos
    .filter((p) => p.estado === "jugado")
    .forEach((partido) => {
      const teamA = [partido.equipo_a_alumno_1_id, partido.equipo_a_alumno_2_id].filter(Boolean).map(Number);
      const teamB = [partido.equipo_b_alumno_1_id, partido.equipo_b_alumno_2_id].filter(Boolean).map(Number);
      const puntosA = Number(partido.puntos_a || 0);
      const puntosB = Number(partido.puntos_b || 0);

      teamA.forEach((id) => {
        const row = rankingMap.get(id);
        if (!row) return;
        row.puntos += puntosA;
        row.partidos += 1;
        row.diferencia += puntosA - puntosB;
        if (puntosA > puntosB) row.victorias += 1;
      });

      teamB.forEach((id) => {
        const row = rankingMap.get(id);
        if (!row) return;
        row.puntos += puntosB;
        row.partidos += 1;
        row.diferencia += puntosB - puntosA;
        if (puntosB > puntosA) row.victorias += 1;
      });
    });

  const clasificacion = Array.from(rankingMap.values()).sort((a, b) =>
    b.puntos - a.puntos || b.victorias - a.victorias || b.diferencia - a.diferencia || a.nombre.localeCompare(b.nombre)
  );

  return { americano: americanos[0], participantes, parejas, partidos, clasificacion, incidencias };
}

router.get("/americanos/catalogo/alumnos", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const columns = await getTableColumns("alumnos");
    const selects = [
      "id",
      "nombre",
      columns.has("apellidos") ? "apellidos" : "NULL AS apellidos",
      columns.has("nivel") ? "nivel" : "NULL AS nivel",
      columns.has("nivel_juego") ? "nivel_juego" : "NULL AS nivel_juego",
    ];
    const activeWhere = columns.has("activo") ? "WHERE activo = 1" : "";
    const orderBy = columns.has("apellidos") ? "apellidos, nombre" : "nombre";
    const [rows] = await query(
      `SELECT ${selects.join(", ")} FROM alumnos ${activeWhere} ORDER BY ${orderBy}`
    );
    res.json({ ok: true, alumnos: rows });
  } catch (e) {
    console.error("Error GET /api/torneos/americanos/catalogo/alumnos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.get("/americanos", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await query(
      `SELECT ta.*, COUNT(DISTINCT ap.id) AS participantes, COUNT(DISTINCT p.id) AS partidos
       FROM torneos_americanos ta
       LEFT JOIN americano_participantes ap ON ap.americano_id = ta.id
       LEFT JOIN americano_partidos p ON p.americano_id = ta.id
       GROUP BY ta.id
       ORDER BY ta.fecha DESC, ta.id DESC`
    );
    res.json({ ok: true, americanos: rows });
  } catch (e) {
    console.error("Error GET /api/torneos/americanos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const fecha = req.body.fecha;
    const categoria = String(req.body.categoria || "Judex").trim();

    if (!nombre || !fecha) {
      return res.status(400).json({ ok: false, message: "Nombre y fecha son obligatorios" });
    }

    const [result] = await query(
      `INSERT INTO torneos_americanos
       (nombre, fecha, categoria, pistas, duracion_min, observaciones, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        fecha,
        categoria,
        req.body.pistas?.trim() || null,
        normalizeOptionalNumber(req.body.duracion_min),
        req.body.observaciones?.trim() || null,
        req.body.estado || "preparacion",
        req.user.id,
      ]
    );

    res.status(201).json({ ok: true, id: result.insertId, message: "Americano creado" });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.get("/americanos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });
    res.json({ ok: true, ...detail });
  } catch (e) {
    console.error("Error GET /api/torneos/americanos/:id:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.patch("/americanos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = ["nombre", "fecha", "categoria", "pistas", "duracion_min", "observaciones", "estado"];
    const fields = [];
    const values = [];

    allowed.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) return;
      fields.push(`${field} = ?`);
      if (field === "duracion_min") values.push(normalizeOptionalNumber(req.body[field]));
      else values.push(req.body[field] === "" ? null : req.body[field]);
    });

    if (!fields.length) return res.status(400).json({ ok: false, message: "No hay cambios para guardar" });

    await query(
      `UPDATE torneos_americanos SET ${fields.join(", ")} WHERE id = ?`,
      [...values, req.params.id]
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });
    res.json({ ok: true, message: "Americano actualizado", ...detail });
  } catch (e) {
    console.error("Error PATCH /api/torneos/americanos/:id:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos/:id/participantes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const alumnoIds = [...new Set((req.body.alumno_ids || [req.body.alumno_id]).map(Number).filter(Boolean))];
    if (!alumnoIds.length) return res.status(400).json({ ok: false, message: "Selecciona al menos un alumno" });

    await query(
      `INSERT IGNORE INTO americano_participantes (americano_id, alumno_id)
       VALUES ${alumnoIds.map(() => "(?, ?)").join(", ")}`,
      alumnoIds.flatMap((alumnoId) => [req.params.id, alumnoId])
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    res.status(201).json({ ok: true, message: "Participantes actualizados", ...detail });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos/:id/participantes:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.delete("/americanos/:id/participantes/:alumnoId", requireAuth, requireAdmin, async (req, res) => {
  try {
    await query(
      "DELETE FROM americano_participantes WHERE americano_id = ? AND alumno_id = ?",
      [req.params.id, req.params.alumnoId]
    );
    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Participante eliminado", ...detail });
  } catch (e) {
    console.error("Error DELETE /api/torneos/americanos/:id/participantes/:alumnoId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos/:id/generar-parejas", requireAuth, requireAdmin, async (req, res) => {
  try {
    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });

    const requestedIds = [...new Set((req.body.alumno_ids || []).map(Number).filter(Boolean))];
    const source = requestedIds.length
      ? detail.participantes.filter((p) => requestedIds.includes(Number(p.alumno_id)))
      : detail.participantes;

    if (source.length < 4) {
      return res.status(400).json({ ok: false, message: "Necesitas al menos 4 jugadores para crear un americano." });
    }

    const result = generateRandomPairs(source.map((player) => ({
      alumno_id: player.alumno_id,
      nombre: player.nombre,
    })));

    res.json({ ok: true, message: result.reserve ? "Hay un jugador sin pareja." : "Parejas generadas correctamente.", ...result });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos/:id/generar-parejas:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos/:id/parejas", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await tableExists("americano_parejas"))) {
      return res.status(501).json({ ok: false, message: "Ejecuta primero la SQL de gestion de Americano." });
    }

    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });

    const parejas = Array.isArray(req.body.parejas) ? req.body.parejas : [req.body];
    const participantesIds = new Set(detail.participantes.map((p) => Number(p.alumno_id)));
    const existingIds = new Set((detail.parejas || []).flatMap((p) => [
      p.jugador1_alumno_id,
      p.jugador2_alumno_id,
    ]).filter(Boolean).map(Number));
    const usedIds = new Set();
    const rows = [];

    for (const pareja of parejas) {
      const jugador1Id = Number(pareja.jugador1_alumno_id || pareja.jugador1?.alumno_id);
      const jugador2Id = normalizeOptionalNumber(pareja.jugador2_alumno_id || pareja.jugador2?.alumno_id);
      const estado = normalizeEstadoPareja(pareja.estado);

      if (!jugador1Id) return res.status(400).json({ ok: false, message: "No se puede guardar una pareja vacia." });
      if (jugador2Id && jugador1Id === jugador2Id) {
        return res.status(400).json({ ok: false, message: "No se puede guardar una pareja con el mismo jugador dos veces." });
      }
      if (!participantesIds.has(jugador1Id) || (jugador2Id && !participantesIds.has(jugador2Id))) {
        return res.status(400).json({ ok: false, message: "Todos los jugadores deben pertenecer al americano." });
      }
      if (existingIds.has(jugador1Id) || (jugador2Id && existingIds.has(jugador2Id))) {
        return res.status(400).json({ ok: false, message: "Jugador duplicado en otra pareja." });
      }
      if (usedIds.has(jugador1Id) || (jugador2Id && usedIds.has(jugador2Id))) {
        return res.status(400).json({ ok: false, message: "Jugador duplicado en otra pareja." });
      }

      usedIds.add(jugador1Id);
      if (jugador2Id) usedIds.add(jugador2Id);
      rows.push([req.params.id, jugador1Id, jugador2Id, pareja.jugador1_nombre || null, pareja.jugador2_nombre || null, estado, pareja.notas || null]);
    }

    if (!rows.length) return res.status(400).json({ ok: false, message: "No hay parejas para guardar." });

    await query(
      `INSERT INTO americano_parejas
       (americano_id, jugador1_alumno_id, jugador2_alumno_id, jugador1_nombre, jugador2_nombre, estado, notas)
       VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
      rows.flat()
    );

    const nextDetail = await fetchAmericanoDetail(req.params.id);
    res.status(201).json({ ok: true, message: "Parejas guardadas.", ...nextDetail });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos/:id/parejas:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.put("/americanos/:id/parejas/:parejaId", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await tableExists("americano_parejas"))) {
      return res.status(501).json({ ok: false, message: "Ejecuta primero la SQL de gestion de Americano." });
    }

    const jugador1Id = Number(req.body.jugador1_alumno_id);
    const jugador2Id = normalizeOptionalNumber(req.body.jugador2_alumno_id);

    if (!jugador1Id) return res.status(400).json({ ok: false, message: "No se puede guardar una pareja vacia." });
    if (jugador2Id && jugador1Id === jugador2Id) {
      return res.status(400).json({ ok: false, message: "No se puede guardar una pareja con el mismo jugador dos veces." });
    }

    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });

    const participantesIds = new Set(detail.participantes.map((p) => Number(p.alumno_id)));
    if (!participantesIds.has(jugador1Id) || (jugador2Id && !participantesIds.has(jugador2Id))) {
      return res.status(400).json({ ok: false, message: "Todos los jugadores deben pertenecer al americano." });
    }

    const duplicated = (detail.parejas || []).some((pair) => {
      if (Number(pair.id) === Number(req.params.parejaId)) return false;
      return [pair.jugador1_alumno_id, pair.jugador2_alumno_id]
        .filter(Boolean)
        .map(Number)
        .some((id) => id === jugador1Id || id === jugador2Id);
    });

    if (duplicated) return res.status(400).json({ ok: false, message: "Jugador duplicado en otra pareja." });

    await query(
      `UPDATE americano_parejas
       SET jugador1_alumno_id = ?, jugador2_alumno_id = ?, jugador1_nombre = ?, jugador2_nombre = ?, estado = ?, notas = ?
       WHERE id = ? AND americano_id = ?`,
      [
        jugador1Id,
        jugador2Id,
        req.body.jugador1_nombre || null,
        req.body.jugador2_nombre || null,
        normalizeEstadoPareja(req.body.estado),
        req.body.notas || null,
        req.params.parejaId,
        req.params.id,
      ]
    );

    const nextDetail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Pareja actualizada.", ...nextDetail });
  } catch (e) {
    console.error("Error PUT /api/torneos/americanos/:id/parejas/:parejaId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.delete("/americanos/:id/parejas/:parejaId", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await tableExists("americano_parejas"))) {
      return res.status(501).json({ ok: false, message: "Ejecuta primero la SQL de gestion de Americano." });
    }

    await query("DELETE FROM americano_parejas WHERE id = ? AND americano_id = ?", [req.params.parejaId, req.params.id]);
    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Pareja eliminada.", ...detail });
  } catch (e) {
    console.error("Error DELETE /api/torneos/americanos/:id/parejas/:parejaId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos/:id/incidencias", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await tableExists("americano_incidencias"))) {
      return res.status(501).json({ ok: false, message: "Ejecuta primero la SQL de gestion de Americano." });
    }

    const titulo = String(req.body.titulo || "").trim();
    if (!titulo) return res.status(400).json({ ok: false, message: "El titulo de la incidencia es obligatorio." });

    await query(
      `INSERT INTO americano_incidencias
       (americano_id, partido_id, pareja_id, tipo, titulo, descripcion, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        normalizeOptionalNumber(req.body.partido_id),
        normalizeOptionalNumber(req.body.pareja_id),
        normalizeIncidenciaTipo(req.body.tipo),
        titulo,
        req.body.descripcion?.trim() || null,
        normalizeIncidenciaEstado(req.body.estado),
        req.user.id,
      ]
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    res.status(201).json({ ok: true, message: "Incidencia registrada.", ...detail });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos/:id/incidencias:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.patch("/americanos/:id/incidencias/:incidenciaId", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await tableExists("americano_incidencias"))) {
      return res.status(501).json({ ok: false, message: "Ejecuta primero la SQL de gestion de Americano." });
    }

    const allowed = ["tipo", "titulo", "descripcion", "estado", "partido_id", "pareja_id"];
    const fields = [];
    const values = [];

    allowed.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) return;
      fields.push(`${field} = ?`);
      if (field === "tipo") values.push(normalizeIncidenciaTipo(req.body[field]));
      else if (field === "estado") values.push(normalizeIncidenciaEstado(req.body[field]));
      else if (field === "partido_id" || field === "pareja_id") values.push(normalizeOptionalNumber(req.body[field]));
      else values.push(req.body[field] || null);
    });

    if (!fields.length) return res.status(400).json({ ok: false, message: "No hay cambios para guardar" });

    await query(
      `UPDATE americano_incidencias SET ${fields.join(", ")} WHERE id = ? AND americano_id = ?`,
      [...values, req.params.incidenciaId, req.params.id]
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Incidencia actualizada.", ...detail });
  } catch (e) {
    console.error("Error PATCH /api/torneos/americanos/:id/incidencias/:incidenciaId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.post("/americanos/:id/partidos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = {
      ronda: normalizeOptionalNumber(req.body.ronda),
      orden: normalizeOptionalNumber(req.body.orden),
      equipo_a_alumno_1_id: Number(req.body.equipo_a_alumno_1_id),
      equipo_a_alumno_2_id: normalizeOptionalNumber(req.body.equipo_a_alumno_2_id),
      equipo_b_alumno_1_id: Number(req.body.equipo_b_alumno_1_id),
      equipo_b_alumno_2_id: normalizeOptionalNumber(req.body.equipo_b_alumno_2_id),
      puntos_a: normalizeOptionalNumber(req.body.puntos_a) ?? 0,
      puntos_b: normalizeOptionalNumber(req.body.puntos_b) ?? 0,
      estado: req.body.estado || "pendiente",
      notas: req.body.notas?.trim() || null,
    };

    if (!payload.equipo_a_alumno_1_id || !payload.equipo_b_alumno_1_id) {
      return res.status(400).json({ ok: false, message: "Selecciona al menos un jugador por equipo" });
    }

    const playerIds = [
      payload.equipo_a_alumno_1_id,
      payload.equipo_a_alumno_2_id,
      payload.equipo_b_alumno_1_id,
      payload.equipo_b_alumno_2_id,
    ].filter(Boolean);

    if (new Set(playerIds).size !== playerIds.length) {
      return res.status(400).json({ ok: false, message: "Un alumno no puede repetirse en el mismo mini partido" });
    }

    await query(
      `INSERT INTO americano_partidos
       (americano_id, ronda, orden, equipo_a_alumno_1_id, equipo_a_alumno_2_id, equipo_b_alumno_1_id, equipo_b_alumno_2_id, puntos_a, puntos_b, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        payload.ronda,
        payload.orden,
        payload.equipo_a_alumno_1_id,
        payload.equipo_a_alumno_2_id,
        payload.equipo_b_alumno_1_id,
        payload.equipo_b_alumno_2_id,
        payload.puntos_a,
        payload.puntos_b,
        payload.estado,
        payload.notas,
      ]
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    res.status(201).json({ ok: true, message: "Partido creado", ...detail });
  } catch (e) {
    console.error("Error POST /api/torneos/americanos/:id/partidos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.patch("/americanos/:id/partidos/:partidoId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = [
      "ronda",
      "orden",
      "equipo_a_alumno_1_id",
      "equipo_a_alumno_2_id",
      "equipo_b_alumno_1_id",
      "equipo_b_alumno_2_id",
      "puntos_a",
      "puntos_b",
      "estado",
      "notas",
    ];
    const fields = [];
    const values = [];

    allowed.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) return;
      fields.push(`${field} = ?`);
      values.push(field === "estado" || field === "notas" ? (req.body[field] || null) : normalizeOptionalNumber(req.body[field]));
    });

    if (!fields.length) return res.status(400).json({ ok: false, message: "No hay cambios para guardar" });

    await query(
      `UPDATE americano_partidos SET ${fields.join(", ")} WHERE id = ? AND americano_id = ?`,
      [...values, req.params.partidoId, req.params.id]
    );

    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Partido actualizado", ...detail });
  } catch (e) {
    console.error("Error PATCH /api/torneos/americanos/:id/partidos/:partidoId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

router.delete("/americanos/:id/partidos/:partidoId", requireAuth, requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM americano_partidos WHERE id = ? AND americano_id = ?", [req.params.partidoId, req.params.id]);
    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Partido eliminado", ...detail });
  } catch (e) {
    console.error("Error DELETE /api/torneos/americanos/:id/partidos/:partidoId:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

// GET /api/torneos (listar todos los torneos)
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { categoria, estado } = req.query;

    const filters = [];
    const values = [];

    if (categoria) {
      filters.push("t.categoria = ?");
      values.push(categoria);
    }

    if (estado) {
      filters.push("t.estado = ?");
      values.push(estado);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await query(
      `SELECT 
        t.*,
        COUNT(ti.id) AS inscritos
      FROM torneos t
      LEFT JOIN torneo_inscripciones ti ON ti.torneo_id = t.id AND ti.estado != 'cancelada'
      ${where}
      GROUP BY t.id
      ORDER BY t.fecha_inicio ASC`,
      values
    );

    // Si el usuario está logueado, añadir si está inscrito en cada torneo
    if (req.user) {
      const [misInscripciones] = await query(
        "SELECT torneo_id FROM torneo_inscripciones WHERE usuario_id = ? AND estado != 'cancelada'",
        [req.user.id]
      );
      const misIds = new Set(misInscripciones.map((i) => i.torneo_id));
      rows.forEach((t) => {
        t.inscrito = misIds.has(t.id);
      });
    }

    res.json({ ok: true, torneos: rows });
  } catch (e) {
    console.error("Error GET /api/torneos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

// POST /api/torneos (crear torneo - solo profesor/admin)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      nombre, descripcion, categoria, modalidad,
      fecha_inicio, fecha_fin, hora_inicio, nivel,
      edad_min, edad_max, max_parejas, precio, estado,
      tipo_torneo, configuracion_formato, plazas_maximas,
      pistas_necesarias, cartel_url, imagen_url,
    } = req.body;

    if (!nombre || !categoria || !fecha_inicio) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios (nombre, categoria, fecha_inicio)" });
    }

    const columns = await getTableColumns("torneos");
    const insertColumns = [];
    const insertValues = [];
    const maxParejas = normalizeOptionalNumber(max_parejas) || normalizeOptionalNumber(plazas_maximas) || 16;
    const selectedFormat = tipo_torneo || "americano";

    pushInsertField(columns, insertColumns, insertValues, "nombre", nombre);
    pushInsertField(columns, insertColumns, insertValues, "descripcion", descripcion || null);
    pushInsertField(columns, insertColumns, insertValues, "categoria", categoria);
    pushInsertField(columns, insertColumns, insertValues, "modalidad", modalidad || selectedFormat || null);
    pushInsertField(columns, insertColumns, insertValues, "fecha_inicio", fecha_inicio);
    pushInsertField(columns, insertColumns, insertValues, "fecha_fin", fecha_fin || null);
    pushInsertField(columns, insertColumns, insertValues, "hora_inicio", hora_inicio || null);
    pushInsertField(columns, insertColumns, insertValues, "nivel", nivel || null);
    pushInsertField(columns, insertColumns, insertValues, "edad_min", normalizeOptionalNumber(edad_min));
    pushInsertField(columns, insertColumns, insertValues, "edad_max", normalizeOptionalNumber(edad_max));
    pushInsertField(columns, insertColumns, insertValues, "max_parejas", maxParejas);
    pushInsertField(columns, insertColumns, insertValues, "plazas_maximas", maxParejas);
    pushInsertField(columns, insertColumns, insertValues, "precio", normalizeOptionalNumber(precio) || 0);
    pushInsertField(columns, insertColumns, insertValues, "estado", estado || "proximo");
    pushInsertField(columns, insertColumns, insertValues, "creado_por", req.user.id);
    pushInsertField(columns, insertColumns, insertValues, "tipo_torneo", selectedFormat);
    pushInsertField(columns, insertColumns, insertValues, "configuracion_formato", normalizeOptionalJson(configuracion_formato));
    pushInsertField(columns, insertColumns, insertValues, "pistas_necesarias", normalizeOptionalNumber(pistas_necesarias));
    pushInsertField(columns, insertColumns, insertValues, "cartel_url", cartel_url || imagen_url || null);
    pushInsertField(columns, insertColumns, insertValues, "imagen_url", imagen_url || cartel_url || null);

    const [result] = await query(
      `INSERT INTO torneos (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`,
      insertValues
    );

    res.status(201).json({ ok: true, id: result.insertId, message: "Torneo creado" });
  } catch (e) {
    console.error("Error POST /api/torneos:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

// POST /api/torneos/:id/inscribirse (inscribirse en un torneo)
router.post("/:id/inscribirse", requireAuth, async (req, res) => {
  try {
    const torneoId = req.params.id;
    const { nombre_pareja, telefono_contacto } = req.body;

    // Comprobar que el torneo existe y está abierto
    const [torneos] = await query(
      "SELECT * FROM torneos WHERE id = ? AND estado IN ('abierto', 'proximo')",
      [torneoId]
    );

    if (torneos.length === 0) {
      return res.status(404).json({ ok: false, message: "Torneo no encontrado o no disponible" });
    }

    const torneo = torneos[0];

    // Comprobar si ya está inscrito
    const [existing] = await query(
      "SELECT id FROM torneo_inscripciones WHERE torneo_id = ? AND usuario_id = ? AND estado != 'cancelada'",
      [torneoId, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ ok: false, message: "Ya estás inscrito en este torneo" });
    }

    // Comprobar si hay plazas
    const [countResult] = await query(
      "SELECT COUNT(*) AS total FROM torneo_inscripciones WHERE torneo_id = ? AND estado != 'cancelada'",
      [torneoId]
    );

    if (torneo.max_parejas && countResult[0].total >= torneo.max_parejas) {
      return res.status(409).json({ ok: false, message: "No quedan plazas disponibles" });
    }

    await query(
      "INSERT INTO torneo_inscripciones (torneo_id, usuario_id, nombre_pareja, telefono_contacto) VALUES (?, ?, ?, ?)",
      [torneoId, req.user.id, nombre_pareja || null, telefono_contacto || null]
    );

    res.status(201).json({ ok: true, message: "Inscripción realizada" });
  } catch (e) {
    console.error("Error POST /api/torneos/:id/inscribirse:", e);
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

// PATCH /api/torneos/:id/cancelar-inscripcion
router.patch("/:id/cancelar-inscripcion", requireAuth, async (req, res) => {
  try {
    const [result] = await query(
      "UPDATE torneo_inscripciones SET estado = 'cancelada' WHERE torneo_id = ? AND usuario_id = ? AND estado != 'cancelada'",
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "No estás inscrito en este torneo" });
    }

    res.json({ ok: true, message: "Inscripción cancelada" });
  } catch (e) {
    res.status(500).json({ ok: false, message: "No se ha podido completar la operación." });
  }
});

export default router;
