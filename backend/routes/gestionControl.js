import express from "express";
import { db } from "../db/connection.js";

const router = express.Router();
const SEDE = "Seminario Diocesano";
const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
const ATTENDANCE = new Set(["presente", "falta", "justificada"]);
const SESSION_STATES = new Set(["programada", "dada"]);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) fail(400, "Indica una fecha valida");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(400, "Indica una fecha valida");
  return DAYS[date.getUTCDay()];
}

async function getContext(connection) {
  const [rows] = await connection.query(
    `SELECT c.id AS curso_id, s.id AS sede_id
     FROM cursos_escolares c
     JOIN sedes s ON s.nombre = ?
     WHERE c.activo = 1
     ORDER BY c.id DESC LIMIT 1`,
    [SEDE]
  );
  if (!rows.length) fail(409, `No hay un curso activo para la sede ${SEDE}`);
  return rows[0];
}

async function getProfessorId(connection, user) {
  const [columns] = await connection.query("SHOW COLUMNS FROM profesores");
  const names = new Set(columns.map((row) => row.Field));
  const conditions = [];
  const params = [];
  if (names.has("usuario_id")) {
    conditions.push("usuario_id = ?");
    params.push(user.id);
  }
  if (names.has("email") && user.email) {
    conditions.push("email = ?");
    params.push(user.email);
  }
  if (!conditions.length) {
    if (names.has("usuario_id") || names.has("email")) return 0;
    conditions.push("id = ?");
    params.push(user.id);
  }
  const activeFilter = names.has("activo") ? " AND activo = 1" : "";
  const [rows] = await connection.query(
    `SELECT id FROM profesores WHERE (${conditions.join(" OR ")})${activeFilter} LIMIT 1`, params
  );
  return rows[0]?.id || 0;
}

async function requireStaffProfessor(connection, user) {
  const role = String(user?.rol || "").toLowerCase();
  if (role !== "admin" && role !== "profesor" && role !== "profe") fail(403, "No tienes acceso al control de clases");
  const professorId = role === "admin" ? null : await getProfessorId(connection, user);
  if (role !== "admin" && !professorId) fail(403, "Tu cuenta no esta vinculada a un profesor activo");
  return professorId;
}

async function getGroup(connection, user, groupId, lock = false) {
  const professorId = await requireStaffProfessor(connection, user);
  const context = await getContext(connection);
  const [rows] = await connection.query(
    `SELECT g.id, g.nombre, g.profesor_id, g.dia1, g.dia2, g.hora_inicio, g.duracion_min
     FROM grupos g
     WHERE g.id = ? AND g.curso_id = ? AND g.sede_id = ? AND g.activo = 1
     LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [groupId, context.curso_id, context.sede_id]
  );
  const group = rows[0];
  if (!group) fail(404, "Grupo activo no encontrado en el curso y sede actuales");
  return { group, context, professorId };
}

function endTime(start, minutes) {
  const [hours, mins] = String(start).split(":").map(Number);
  const total = hours * 60 + mins + Number(minutes || 60);
  if (!Number.isFinite(total) || total <= hours * 60 + mins || total >= 24 * 60) fail(400, "El horario del grupo no es valido");
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

async function getRoster(connection, group, context, day) {
  const [rows] = await connection.query(
    `SELECT a.id, a.nombre, a.apellidos, a.nivel, ga.asiste_dia1, ga.asiste_dia2
     FROM grupo_alumnos ga
     JOIN alumnos a ON a.id = ga.alumno_id AND a.activo = 1
     JOIN alumno_curso ac ON ac.alumno_id = a.id
       AND ac.curso_id = ? AND ac.sede_id = ? AND COALESCE(ac.estado, '') <> 'baja'
     WHERE ga.grupo_id = ? AND ga.activo = 1
       AND ((? = ? AND COALESCE(ga.asiste_dia1, 1) = 1)
         OR (? = ? AND COALESCE(ga.asiste_dia2, 1) = 1))
     ORDER BY a.apellidos, a.nombre`,
    [context.curso_id, context.sede_id, group.id, day, group.dia1, day, group.dia2]
  );
  return rows;
}

async function getSession(connection, groupId, fecha, lock = false) {
  const [rows] = await connection.query(
    `SELECT id, grupo_id, profesor_id, fecha, hora_inicio, hora_fin, estado, observaciones
     FROM sesiones_clase WHERE grupo_id = ? AND fecha = ?
     ORDER BY id LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [groupId, fecha]
  );
  return rows[0] || null;
}

async function getAttendance(connection, sessionId) {
  if (!sessionId) return [];
  const [rows] = await connection.query(
    "SELECT alumno_id, estado FROM asistencia_clase WHERE sesion_id = ?",
    [sessionId]
  );
  return rows;
}

function sendError(res, error) {
  if (!error.status || error.status >= 500) console.error("Error control de clases:", error);
  res.status(error.status || 500).json({ ok: false, message: error.message });
}

router.get("/grupos", async (req, res) => {
  try {
    const connection = db.promise();
    const professorId = await requireStaffProfessor(connection, req.user);
    const context = await getContext(connection);
    const [grupos] = await connection.query(
      `SELECT g.id, g.codigo, g.nombre, g.nivel, g.dia1, g.dia2,
              g.hora_inicio, g.duracion_min, g.pista_habitual, g.profesor_id,
              CONCAT(p.nombre, ' ', p.apellidos) AS profesor
       FROM grupos g
       LEFT JOIN profesores p ON p.id = g.profesor_id
       WHERE g.curso_id = ? AND g.sede_id = ? AND g.activo = 1
       ORDER BY g.hora_inicio, g.nombre`,
      [context.curso_id, context.sede_id]
    );
    res.json({ ok: true, grupos, profesor_actual_id: professorId });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/grupos/:grupoId/sesiones", async (req, res) => {
  try {
    const fecha = String(req.query.fecha || "");
    const day = validDate(fecha);
    const connection = db.promise();
    const { group, context, professorId } = await getGroup(connection, req.user, req.params.grupoId);
    const [sesion, alumnos] = await Promise.all([
      getSession(connection, group.id, fecha),
      getRoster(connection, group, context, day),
    ]);
    const asistencias = await getAttendance(connection, sesion?.id);
    res.json({ ok: true, sesiones: sesion ? [sesion] : [], alumnos, asistencias, dia: day, profesor_actual_id: professorId });
  } catch (error) {
    sendError(res, error);
  }
});

async function save(req, res, sessionId = null) {
  let connection;
  try {
    const fecha = String(req.body.fecha || "");
    const day = validDate(fecha);
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const { group, context, professorId: linkedProfessorId } = await getGroup(connection, req.user, req.params.grupoId, true);
    if (day !== group.dia1 && day !== group.dia2) fail(400, "El grupo no tiene clase en ese dia");
    const alumnos = await getRoster(connection, group, context, day);
    const allowed = new Set(alumnos.map((alumno) => Number(alumno.id)));
    const entries = req.body.asistencias;
    if (entries !== undefined) {
      if (!Array.isArray(entries)) fail(400, "Las asistencias deben ser una lista");
      const seen = new Set();
      for (const entry of entries) {
        const id = Number(entry?.alumno_id);
        if (!allowed.has(id) || seen.has(id) || !ATTENDANCE.has(entry?.estado)) {
          fail(400, "La asistencia contiene un alumno o estado no valido");
        }
        seen.add(id);
      }
      if (seen.size !== allowed.size) fail(400, "Indica la asistencia de todos los alumnos del dia");
    }
    if (req.body.estado !== undefined && !SESSION_STATES.has(req.body.estado)) fail(400, "Estado de sesion no valido");
    const hasProfessorId = Object.prototype.hasOwnProperty.call(req.body, "profesor_id");
    const isAdmin = String(req.user?.rol).toLowerCase() === "admin";
    const professorId = hasProfessorId && req.body.profesor_id !== "" && req.body.profesor_id != null
      ? Number(req.body.profesor_id)
      : isAdmin ? (hasProfessorId ? null : undefined) : linkedProfessorId;
    if (hasProfessorId && professorId !== null && professorId !== linkedProfessorId) {
      if (!Number.isInteger(professorId) || professorId <= 0) fail(400, "Profesor no valido");
      const [professors] = await connection.query("SELECT id FROM profesores WHERE id = ? LIMIT 1", [professorId]);
      if (!professors.length) fail(400, "Profesor no encontrado");
    }
    let sesion = await getSession(connection, group.id, fecha, true);
    if (sessionId && Number(sesion?.id) !== Number(sessionId)) fail(404, "Sesion no encontrada");
    if (!sesion) {
      const [inserted] = await connection.query(
        `INSERT INTO sesiones_clase
         (grupo_id, profesor_id, fecha, hora_inicio, hora_fin, estado, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [group.id, professorId ?? null,
          fecha, group.hora_inicio, endTime(group.hora_inicio, group.duracion_min),
          req.body.estado || "programada", req.body.observaciones ?? null]
      );
      sesion = { id: inserted.insertId };
    } else if (entries !== undefined || professorId !== undefined || req.body.estado !== undefined || req.body.observaciones !== undefined) {
      await connection.query(
        `UPDATE sesiones_clase SET profesor_id = ?, estado = ?, observaciones = ? WHERE id = ?`,
        [professorId === undefined ? sesion.profesor_id : professorId,
          req.body.estado ?? sesion.estado, req.body.observaciones === undefined ? sesion.observaciones : req.body.observaciones,
          sesion.id]
      );
    }
    if (entries !== undefined) {
      for (const entry of entries) {
        const [existing] = await connection.query(
          "SELECT id FROM asistencia_clase WHERE sesion_id = ? AND alumno_id = ? LIMIT 1 FOR UPDATE",
          [sesion.id, entry.alumno_id]
        );
        if (existing.length) {
          await connection.query("UPDATE asistencia_clase SET estado = ? WHERE sesion_id = ? AND alumno_id = ?",
            [entry.estado, sesion.id, entry.alumno_id]);
        } else {
          await connection.query("INSERT INTO asistencia_clase (sesion_id, alumno_id, estado) VALUES (?, ?, ?)",
            [sesion.id, entry.alumno_id, entry.estado]);
        }
      }
    }
    sesion = await getSession(connection, group.id, fecha);
    const asistencias = await getAttendance(connection, sesion.id);
    await connection.commit();
    res.json({ ok: true, sesion, alumnos, asistencias, dia: day });
  } catch (error) {
    if (connection) await connection.rollback();
    sendError(res, error);
  } finally {
    connection?.release();
  }
}

router.post("/grupos/:grupoId/sesiones", (req, res) => save(req, res));
router.put("/grupos/:grupoId/sesiones/:sesionId/asistencia", (req, res) => save(req, res, req.params.sesionId));

export default router;
