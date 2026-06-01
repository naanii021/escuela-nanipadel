import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";
const STAFF_ROLES = ["admin", "profesor", "profe"];
const PUBLIC_LEVELS = [
  { title: "Niños", text: "Aprendizaje seguro y divertido.", price: "Consultar" },
  { title: "Iniciación", text: "Golpes básicos y primeras situaciones reales.", price: "Consultar" },
  { title: "Medio", text: "Consistencia, colocación y decisiones.", price: "Consultar" },
  { title: "Avanzado", text: "Ritmo alto y patrones tácticos.", price: "Consultar" },
  { title: "Competición", text: "Entrenamiento exigente y específico.", price: "Consultar" },
];

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(tableName) {
  if (!(await tableExists(tableName))) return new Set();
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

function pickRefColumn(columns) {
  if (columns.has("grupo_id")) return "grupo_id";
  if (columns.has("clase_id")) return "clase_id";
  return null;
}

function isStaff(user) {
  return STAFF_ROLES.includes(String(user?.rol || "").toLowerCase());
}

function isAdmin(user) {
  return String(user?.rol || "").toLowerCase() === "admin";
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

async function getProfesorIdForUser(user) {
  if (isAdmin(user)) return null;
  const columns = await getTableColumns("profesores");
  const conditions = ["id = ?"];
  const params = [user.id];

  if (columns.has("usuario_id")) {
    conditions.unshift("usuario_id = ?");
    params.unshift(user.id);
  }
  if (columns.has("email") && user.email) {
    conditions.unshift("email = ?");
    params.unshift(user.email);
  }

  const [rows] = await query(`SELECT id FROM profesores WHERE ${conditions.join(" OR ")} LIMIT 1`, params);
  return rows[0]?.id || 0;
}

async function ensureProfessorCanAccessGroup(user, groupId) {
  if (isAdmin(user)) return true;
  const profesorId = await getProfesorIdForUser(user);
  if (!profesorId) return false;
  const [rows] = await query("SELECT id FROM grupos WHERE id = ? AND profesor_id = ? LIMIT 1", [groupId, profesorId]);
  return rows.length > 0;
}

async function getAlumnoForUser(userId) {
  const columns = await getTableColumns("alumnos");
  if (!columns.has("usuario_id")) {
    return { alumno: null, message: "Tu cuenta aún no está vinculada a un alumno de la escuela." };
  }

  const activeFilter = columns.has("activo") ? "AND activo = 1" : "";
  const [rows] = await query(`SELECT * FROM alumnos WHERE usuario_id = ? ${activeFilter} LIMIT 1`, [userId]);
  return {
    alumno: rows[0] || null,
    message: rows.length ? null : "Tu cuenta aún no está vinculada a un alumno de la escuela.",
  };
}

async function getGroupsForAlumno(alumnoId) {
  const [rows] = await query(
    `SELECT
      g.id,
      g.codigo,
      g.nombre,
      g.nivel,
      g.dia1,
      g.dia2,
      g.hora_inicio,
      g.duracion_min,
      g.pista_habitual,
      g.cupo,
      g.activo,
      p.id AS profesor_id,
      CONCAT(p.nombre, ' ', p.apellidos) AS profesor,
      COUNT(ga_all.alumno_id) AS alumnos
     FROM grupo_alumnos ga
     JOIN grupos g ON g.id = ga.grupo_id AND g.activo = 1
     LEFT JOIN profesores p ON p.id = g.profesor_id
     LEFT JOIN grupo_alumnos ga_all ON ga_all.grupo_id = g.id AND ga_all.activo = 1
     WHERE ga.alumno_id = ? AND ga.activo = 1
     GROUP BY
      g.id, g.codigo, g.nombre, g.nivel, g.dia1, g.dia2, g.hora_inicio,
      g.duracion_min, g.pista_habitual, g.cupo, g.activo,
      p.id, p.nombre, p.apellidos
     ORDER BY g.hora_inicio`,
    [alumnoId]
  );
  return rows;
}

async function getGroupsForStaff(user) {
  const profesorId = await getProfesorIdForUser(user);
  if (!isAdmin(user) && !profesorId) return [];

  const where = isAdmin(user) ? "" : "WHERE g.profesor_id = ?";
  const params = isAdmin(user) ? [] : [profesorId];
  const [rows] = await query(
    `SELECT
      g.id,
      g.codigo,
      g.nombre,
      g.nivel,
      g.dia1,
      g.dia2,
      g.hora_inicio,
      g.duracion_min,
      g.pista_habitual,
      g.cupo,
      g.activo,
      p.id AS profesor_id,
      CONCAT(p.nombre, ' ', p.apellidos) AS profesor,
      COUNT(ga.alumno_id) AS alumnos
     FROM grupos g
     LEFT JOIN profesores p ON p.id = g.profesor_id
     LEFT JOIN grupo_alumnos ga ON ga.grupo_id = g.id AND ga.activo = 1
     ${where}
     GROUP BY
      g.id, g.codigo, g.nombre, g.nivel, g.dia1, g.dia2, g.hora_inicio,
      g.duracion_min, g.pista_habitual, g.cupo, g.activo,
      p.id, p.nombre, p.apellidos
     ORDER BY g.hora_inicio, g.codigo`,
    params
  );
  return rows;
}

async function getAvisosForGroups(groupIds, onlyActive = true) {
  if (!groupIds.length || !(await tableExists("avisos_clase"))) return [];
  const columns = await getTableColumns("avisos_clase");
  const ref = pickRefColumn(columns);
  if (!ref) return [];

  const filters = [`a.${ref} IN (${placeholders(groupIds)})`];
  const params = [...groupIds];

  if (onlyActive && columns.has("activo")) filters.push("a.activo = 1");
  if (columns.has("visible_desde")) filters.push("(a.visible_desde IS NULL OR a.visible_desde <= NOW())");
  if (columns.has("visible_hasta")) filters.push("(a.visible_hasta IS NULL OR a.visible_hasta >= NOW())");

  const [rows] = await query(
    `SELECT
      a.*,
      g.nombre AS grupo,
      CONCAT(p.nombre, ' ', p.apellidos) AS profesor
     FROM avisos_clase a
     LEFT JOIN grupos g ON g.id = a.${ref}
     LEFT JOIN profesores p ON p.id = a.profesor_id
     WHERE ${filters.join(" AND ")}
     ORDER BY COALESCE(a.visible_desde, a.creado_en) DESC, a.id DESC`,
    params
  );
  return rows;
}

async function getRecuperaciones({ alumnoId = null, groupIds = [], staffUser = null } = {}) {
  if (!(await tableExists("recuperaciones_clase"))) return [];
  const columns = await getTableColumns("recuperaciones_clase");
  const ref = pickRefColumn(columns);
  const filters = [];
  const params = [];

  if (alumnoId) {
    const ownFilters = [];
    if (columns.has("alumno_id")) {
      ownFilters.push("r.alumno_id = ?");
      params.push(alumnoId);
    }
    if (ref && groupIds.length) {
      ownFilters.push(`(r.alumno_id IS NULL AND r.${ref} IN (${placeholders(groupIds)}))`);
      params.push(...groupIds);
    }
    filters.push(`(${ownFilters.join(" OR ") || "1 = 0"})`);
  } else if (staffUser && !isAdmin(staffUser)) {
    if (!ref || !groupIds.length) return [];
    filters.push(`r.${ref} IN (${placeholders(groupIds)})`);
    params.push(...groupIds);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const orderEstado = columns.has("estado")
    ? "CASE r.estado WHEN 'pendiente' THEN 1 WHEN 'asignada' THEN 2 WHEN 'recuperada' THEN 3 ELSE 4 END,"
    : "";

  const [rows] = await query(
    `SELECT
      r.*,
      g.nombre AS grupo,
      a.nombre AS alumno_nombre,
      a.apellidos AS alumno_apellidos
     FROM recuperaciones_clase r
     ${ref ? `LEFT JOIN grupos g ON g.id = r.${ref}` : "LEFT JOIN grupos g ON 1 = 0"}
     LEFT JOIN alumnos a ON a.id = r.alumno_id
     ${where}
     ORDER BY ${orderEstado} r.fecha_original DESC, r.id DESC`,
    params
  );
  return rows;
}

async function getProximasSesiones(groupIds) {
  if (!groupIds.length || !(await tableExists("sesiones_clase"))) return [];
  const columns = await getTableColumns("sesiones_clase");
  const ref = pickRefColumn(columns);
  if (!ref || !columns.has("fecha")) return [];

  const [rows] = await query(
    `SELECT
      s.*,
      g.nombre AS grupo,
      g.pista_habitual,
      CONCAT(p.nombre, ' ', p.apellidos) AS profesor
     FROM sesiones_clase s
     LEFT JOIN grupos g ON g.id = s.${ref}
     LEFT JOIN profesores p ON p.id = s.profesor_id
     WHERE s.${ref} IN (${placeholders(groupIds)}) AND s.fecha >= CURDATE()
     ORDER BY s.fecha ASC, s.hora_inicio ASC
     LIMIT 8`,
    groupIds
  );
  return rows;
}

async function getAsistenciaReciente(alumnoId) {
  if (!alumnoId || !(await tableExists("asistencia_clase")) || !(await tableExists("sesiones_clase"))) return [];
  const sessionColumns = await getTableColumns("sesiones_clase");
  const ref = pickRefColumn(sessionColumns);
  const groupJoin = ref ? `LEFT JOIN grupos g ON g.id = s.${ref}` : "LEFT JOIN grupos g ON 1 = 0";

  const [rows] = await query(
    `SELECT
      ac.*,
      s.fecha,
      s.hora_inicio,
      g.nombre AS grupo
     FROM asistencia_clase ac
     LEFT JOIN sesiones_clase s ON s.id = ac.sesion_id
     ${groupJoin}
     WHERE ac.alumno_id = ?
     ORDER BY s.fecha DESC, s.hora_inicio DESC
     LIMIT 8`,
    [alumnoId]
  );
  return rows;
}

async function getSchoolSchemaStatus() {
  const tables = ["usuarios", "alumnos", "profesores", "grupos", "avisos_clase", "recuperaciones_clase", "sesiones_clase", "asistencia_clase"];
  const status = {};
  for (const table of tables) {
    const exists = await tableExists(table);
    status[table] = { exists, columns: exists ? Array.from(await getTableColumns(table)) : [] };
  }
  return status;
}

// GET /api/clases/publica
router.get("/publica", async (_req, res) => {
  res.json({
    ok: true,
    niveles: PUBLIC_LEVELS,
    formatos: ["Grupos 1 día/semana", "Grupos 2 días/semana", "Clases particulares", "Tecnificación", "Intensivos"],
    horarios: ["Mañanas bajo demanda", "Tardes por niveles", "Fines de semana según grupo"],
    precios: [{ nombre: "Cuotas de escuela", precio: "Consultar" }],
  });
});

// GET /api/clases/schema-status (diagnostico no destructivo para administracion)
router.get("/schema-status", requireAuth, requireRoles(["admin"]), async (_req, res) => {
  try {
    res.json({ ok: true, schema: await getSchoolSchemaStatus() });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/clases/mis-clases
router.get("/mis-clases", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      // Los visitantes solo reciben una señal de vista pública, nunca grupos reales.
      return res.json({ ok: true, tipoVista: "publica", tipo: "publico", clases: [] });
    }

    if (isStaff(req.user)) {
      const grupos = await getGroupsForStaff(req.user);
      const groupIds = grupos.map((grupo) => grupo.id);
      const todayCode = ["D", "L", "M", "X", "J", "V", "S"][new Date().getDay()];
      const clasesHoy = grupos.filter((grupo) => grupo.dia1 === todayCode || grupo.dia2 === todayCode);
      const avisos = await getAvisosForGroups(groupIds, true);
      const recuperaciones = await getRecuperaciones({ groupIds, staffUser: req.user });

      return res.json({
        ok: true,
        tipoVista: isAdmin(req.user) ? "admin" : "profesor",
        tipo: "staff",
        resumen: {
          clasesHoy,
          gruposAsignados: grupos,
          alumnosTotales: grupos.reduce((sum, grupo) => sum + Number(grupo.alumnos || 0), 0),
          avisosActivos: avisos.length,
          recuperacionesPendientes: recuperaciones.filter((item) => item.estado !== "recuperada" && item.estado !== "cancelada").length,
        },
        resumen_profesor: {
          grupos,
          clases_hoy: clasesHoy,
          avisos,
          recuperaciones,
          stats: {
            grupos: grupos.length,
            alumnos: grupos.reduce((sum, grupo) => sum + Number(grupo.alumnos || 0), 0),
            clases_hoy: clasesHoy.length,
            avisos: avisos.length,
            recuperaciones: recuperaciones.length,
          },
        },
      });
    }

    const { alumno, message } = await getAlumnoForUser(req.user.id);
    if (!alumno) {
      return res.json({
        ok: true,
        // Usuario autenticado sin alumno vinculado: no exponemos datos internos.
        tipoVista: "sin_vincular",
        tipo: "usuario",
        alumno: null,
        clases: [],
        avisos: [],
        recuperaciones: [],
        proximasSesiones: [],
        asistenciaReciente: [],
        mensaje: message,
      });
    }

    const clases = await getGroupsForAlumno(alumno.id);
    const groupIds = clases.map((clase) => clase.id);
    const avisos = await getAvisosForGroups(groupIds, true);
    const recuperaciones = await getRecuperaciones({ alumnoId: alumno.id, groupIds });
    const proximasSesiones = await getProximasSesiones(groupIds);
    const asistenciaReciente = await getAsistenciaReciente(alumno.id);

    return res.json({
      ok: true,
      tipoVista: "alumno",
      tipo: "alumno",
      alumno,
      grupo: clases[0] || null,
      profesor: clases[0]?.profesor ? { id: clases[0].profesor_id, nombre: clases[0].profesor } : null,
      horario: clases[0]
        ? { dia1: clases[0].dia1, dia2: clases[0].dia2, hora_inicio: clases[0].hora_inicio, duracion_min: clases[0].duracion_min }
        : null,
      pista: clases[0]?.pista_habitual || null,
      clases,
      avisos,
      recuperaciones,
      proximasSesiones,
      proximas_clases: proximasSesiones,
      asistenciaReciente,
      asistencia: asistenciaReciente,
      mensaje: clases.length ? null : "Aún no tienes grupo asignado. Contacta con la escuela.",
    });
  } catch (e) {
    console.error("Error GET /api/clases/mis-clases:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/clases/avisos
router.get("/avisos", requireAuth, requireRoles(STAFF_ROLES), async (req, res) => {
  try {
    const grupos = await getGroupsForStaff(req.user);
    const avisos = await getAvisosForGroups(grupos.map((grupo) => grupo.id), false);
    res.json({ ok: true, avisos });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/clases/avisos
router.post("/avisos", requireAuth, requireRoles(STAFF_ROLES), async (req, res) => {
  try {
    if (!(await tableExists("avisos_clase"))) {
      return res.status(400).json({ ok: false, message: "No existe la tabla avisos_clase." });
    }

    const columns = await getTableColumns("avisos_clase");
    const ref = pickRefColumn(columns);
    const groupId = Number(req.body.grupo_id || req.body.clase_id);
    const titulo = String(req.body.titulo || "").trim();
    const mensaje = String(req.body.mensaje || "").trim();

    if (!ref || !groupId || !titulo || !mensaje) {
      return res.status(400).json({ ok: false, message: "Faltan grupo, titulo o mensaje." });
    }
    if (!(await ensureProfessorCanAccessGroup(req.user, groupId))) {
      return res.status(403).json({ ok: false, message: "No tienes permiso sobre este grupo." });
    }

    const profesorId = await getProfesorIdForUser(req.user);
    const payload = {
      [ref]: groupId,
      profesor_id: profesorId || req.body.profesor_id || null,
      titulo,
      mensaje,
      tipo: req.body.tipo || "info",
      visible_desde: req.body.visible_desde || null,
      visible_hasta: req.body.visible_hasta || null,
      activo: req.body.activo === undefined ? 1 : Number(Boolean(req.body.activo)),
    };

    const fields = Object.keys(payload).filter((field) => columns.has(field));
    const [result] = await query(
      `INSERT INTO avisos_clase (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      fields.map((field) => payload[field])
    );
    res.status(201).json({ ok: true, id: result.insertId, message: "Aviso creado" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /api/clases/avisos/:id
router.patch("/avisos/:id", requireAuth, requireRoles(STAFF_ROLES), async (req, res) => {
  try {
    const columns = await getTableColumns("avisos_clase");
    const ref = pickRefColumn(columns);
    if (!columns.size || !ref) return res.status(400).json({ ok: false, message: "No existe la estructura de avisos." });

    const [current] = await query(`SELECT * FROM avisos_clase WHERE id = ? LIMIT 1`, [req.params.id]);
    if (!current.length) return res.status(404).json({ ok: false, message: "Aviso no encontrado" });
    if (!(await ensureProfessorCanAccessGroup(req.user, current[0][ref]))) {
      return res.status(403).json({ ok: false, message: "No tienes permiso sobre este aviso." });
    }

    const allowed = ["titulo", "mensaje", "tipo", "visible_desde", "visible_hasta", "activo"];
    const updates = allowed.filter((field) => columns.has(field) && req.body[field] !== undefined);
    if (!updates.length) return res.status(400).json({ ok: false, message: "No hay campos para actualizar." });

    await query(
      `UPDATE avisos_clase SET ${updates.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...updates.map((field) => req.body[field]), req.params.id]
    );
    res.json({ ok: true, message: "Aviso actualizado" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/clases/recuperaciones
router.get("/recuperaciones", requireAuth, async (req, res) => {
  try {
    if (isStaff(req.user)) {
      const grupos = await getGroupsForStaff(req.user);
      const recuperaciones = await getRecuperaciones({ groupIds: grupos.map((grupo) => grupo.id), staffUser: req.user });
      return res.json({ ok: true, recuperaciones });
    }

    const { alumno } = await getAlumnoForUser(req.user.id);
    if (!alumno) return res.json({ ok: true, recuperaciones: [] });
    const grupos = await getGroupsForAlumno(alumno.id);
    const recuperaciones = await getRecuperaciones({ alumnoId: alumno.id, groupIds: grupos.map((grupo) => grupo.id) });
    res.json({ ok: true, recuperaciones });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /api/clases/recuperaciones/:id
router.patch("/recuperaciones/:id", requireAuth, requireRoles(STAFF_ROLES), async (req, res) => {
  try {
    const columns = await getTableColumns("recuperaciones_clase");
    const ref = pickRefColumn(columns);
    if (!columns.size) return res.status(400).json({ ok: false, message: "No existe la estructura de recuperaciones." });

    const [current] = await query("SELECT * FROM recuperaciones_clase WHERE id = ? LIMIT 1", [req.params.id]);
    if (!current.length) return res.status(404).json({ ok: false, message: "Recuperacion no encontrada" });
    if (!isAdmin(req.user) && ref && !(await ensureProfessorCanAccessGroup(req.user, current[0][ref]))) {
      return res.status(403).json({ ok: false, message: "No tienes permiso sobre esta recuperación." });
    }

    const allowedStates = ["pendiente", "asignada", "recuperada", "cancelada"];
    if (req.body.estado && !allowedStates.includes(req.body.estado)) {
      return res.status(400).json({ ok: false, message: "Estado de recuperación no válido." });
    }

    const allowed = ["estado", "fecha_recuperacion", "observaciones"];
    const updates = allowed.filter((field) => columns.has(field) && req.body[field] !== undefined);
    if (!updates.length) return res.status(400).json({ ok: false, message: "No hay campos para actualizar." });

    await query(
      `UPDATE recuperaciones_clase SET ${updates.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...updates.map((field) => req.body[field]), req.params.id]
    );
    res.json({ ok: true, message: "Recuperacion actualizada" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
