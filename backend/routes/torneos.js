import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";
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
    return res.status(401).json({ ok: false, message: "Token inválido o expirado" });
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

function alumnoNameSelect(columns, alias = "a") {
  const apellidos = columns.has("apellidos") ? `${alias}.apellidos` : "''";
  return `TRIM(CONCAT(COALESCE(${alias}.nombre, ''), ' ', COALESCE(${apellidos}, '')))`;
}

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  return { americano: americanos[0], participantes, partidos, clasificacion };
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get("/americanos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const detail = await fetchAmericanoDetail(req.params.id);
    if (!detail) return res.status(404).json({ ok: false, message: "Americano no encontrado" });
    res.json({ ok: true, ...detail });
  } catch (e) {
    console.error("Error GET /api/torneos/americanos/:id:", e);
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.delete("/americanos/:id/partidos/:partidoId", requireAuth, requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM americano_partidos WHERE id = ? AND americano_id = ?", [req.params.partidoId, req.params.id]);
    const detail = await fetchAmericanoDetail(req.params.id);
    res.json({ ok: true, message: "Partido eliminado", ...detail });
  } catch (e) {
    console.error("Error DELETE /api/torneos/americanos/:id/partidos/:partidoId:", e);
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/torneos (crear torneo - solo profesor/admin)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      nombre, descripcion, categoria, modalidad,
      fecha_inicio, fecha_fin, hora_inicio, nivel,
      edad_min, edad_max, max_parejas, precio, estado,
    } = req.body;

    if (!nombre || !categoria || !fecha_inicio) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios (nombre, categoria, fecha_inicio)" });
    }

    const [result] = await query(
      `INSERT INTO torneos (nombre, descripcion, categoria, modalidad, fecha_inicio, fecha_fin, hora_inicio, nivel, edad_min, edad_max, max_parejas, precio, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, descripcion || null, categoria, modalidad || null,
        fecha_inicio, fecha_fin || null, hora_inicio || null, nivel || null,
        edad_min || null, edad_max || null, max_parejas || 16, precio || 0,
        estado || "proximo", req.user.id,
      ]
    );

    res.status(201).json({ ok: true, id: result.insertId, message: "Torneo creado" });
  } catch (e) {
    console.error("Error POST /api/torneos:", e);
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
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
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
