import express from "express";
import { db } from "../db/connection.js";
import { createTelegramLinkCode } from "../services/telegramLinkService.js";

const router = express.Router();
const SEDE = "Seminario Diocesano";
const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
const ATTENDANCE = new Set(["presente", "falta", "justificada"]);
const SESSION_STATES = new Set(["programada", "dada"]);
const RECOVERY_STATES = new Set(["pendiente", "asignada", "recuperada", "cancelada"]);

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

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
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

export async function getProfessorId(connection, user) {
  if (Number.isInteger(Number(user?.profesor_id)) && Number(user.profesor_id) > 0) return Number(user.profesor_id);
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

export async function requireStaffProfessor(connection, user) {
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
    `SELECT g.id, g.codigo, g.nombre, g.nivel, g.profesor_id, g.dia1, g.dia2,
            g.hora_inicio, g.duracion_min, g.pista_habitual
     FROM grupos g
     WHERE g.id = ? AND g.curso_id = ? AND g.sede_id = ? AND g.activo = 1
     LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [groupId, context.curso_id, context.sede_id]
  );
  const group = rows[0];
  if (!group) fail(404, "Grupo activo no encontrado en el curso y sede actuales");
  return { group, context, professorId };
}

export async function listControlGroups(user, connection = db.promise()) {
  const professorId = await requireStaffProfessor(connection, user);
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
  return { grupos, profesor_actual_id: professorId, context };
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

export async function loadControlSession(user, groupId, fecha, connection = db.promise()) {
  const day = validDate(String(fecha || ""));
  const { group, context, professorId } = await getGroup(connection, user, groupId);
  const [sesion, alumnos] = await Promise.all([
    getSession(connection, group.id, fecha),
    getRoster(connection, group, context, day),
  ]);
  const asistencias = await getAttendance(connection, sesion?.id);
  return { sesiones: sesion ? [sesion] : [], alumnos, asistencias, dia: day, profesor_actual_id: professorId, grupo: group };
}

async function syncRecoveries(connection, sesion, asistencias) {
  for (const asistencia of asistencias) {
    const [rows] = await connection.query(
      `SELECT id, estado FROM recuperaciones_clase
       WHERE alumno_id = ? AND sesion_origen_id = ? LIMIT 1 FOR UPDATE`,
      [asistencia.alumno_id, sesion.id]
    );
    const recovery = rows[0];
    const needsRecovery = sesion.estado === "dada" && asistencia.estado === "justificada";

    if (needsRecovery && !recovery) {
      await connection.query(
        `INSERT INTO recuperaciones_clase
         (alumno_id, grupo_id, fecha_original, motivo, estado, sesion_origen_id)
         VALUES (?, ?, ?, 'falta_justificada', 'pendiente', ?)`,
        [asistencia.alumno_id, sesion.grupo_id, sesion.fecha, sesion.id]
      );
    } else if (needsRecovery && recovery.estado === "cancelada") {
      await connection.query(
        `UPDATE recuperaciones_clase
         SET estado = 'pendiente', fecha_recuperacion = NULL, sesion_recuperacion_id = NULL
         WHERE id = ?`,
        [recovery.id]
      );
    } else if (!needsRecovery && recovery && recovery.estado !== "cancelada" && recovery.estado !== "recuperada") {
      await connection.query("UPDATE recuperaciones_clase SET estado = 'cancelada' WHERE id = ?", [recovery.id]);
    }
  }
}

function sendError(res, error) {
  if (!error.status || error.status >= 500) console.error("Error control de clases:", error);
  res.status(error.status || 500).json({ ok: false, message: error.message });
}

router.get("/grupos", async (req, res) => {
  try {
    const { grupos, profesor_actual_id } = await listControlGroups(req.user);
    res.json({ ok: true, grupos, profesor_actual_id });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/telegram/link-code", async (req, res) => {
  try {
    const role = String(req.user?.rol || "").toLowerCase();
    if (role !== "profesor" && role !== "profe") fail(403, "Solo un profesor puede vincular su Telegram");
    const connection = db.promise();
    const professorId = await requireStaffProfessor(connection, req.user);
    const code = await createTelegramLinkCode(professorId, connection);
    const username = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
    res.json({
      ok: true,
      code,
      expires_in_minutes: 10,
      command: `/start ${code}`,
      link: username ? `https://t.me/${username}?start=${code}` : null,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/grupos/:grupoId/sesiones", async (req, res) => {
  try {
    const fecha = String(req.query.fecha || "");
    const result = await loadControlSession(req.user, req.params.grupoId, fecha);
    const { grupo: _grupo, ...response } = result;
    res.json({ ok: true, ...response });
  } catch (error) {
    sendError(res, error);
  }
});

export async function listControlRecoveries(user, connection = db.promise()) {
  await requireStaffProfessor(connection, user);
  const context = await getContext(connection);
  const [recuperaciones] = await connection.query(
      `SELECT r.id, r.alumno_id, r.grupo_id, r.sesion_origen_id,
              r.sesion_recuperacion_id,
              DATE_FORMAT(r.fecha_original, '%Y-%m-%d') AS fecha_original,
              DATE_FORMAT(r.fecha_recuperacion, '%Y-%m-%d') AS fecha_recuperacion,
              r.motivo, r.estado, r.observaciones,
              a.nombre AS alumno_nombre, a.apellidos AS alumno_apellidos,
              g.nombre AS grupo_origen
       FROM recuperaciones_clase r
       JOIN grupos g ON g.id = r.grupo_id
         AND g.curso_id = ? AND g.sede_id = ?
       LEFT JOIN alumnos a ON a.id = r.alumno_id
       ORDER BY r.fecha_original DESC, r.id DESC`,
      [context.curso_id, context.sede_id]
    );
  const [sesiones] = await connection.query(
      `SELECT s.id, s.grupo_id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha,
              s.hora_inicio, g.nombre AS grupo_nombre
       FROM sesiones_clase s
       JOIN grupos g ON g.id = s.grupo_id
         AND g.curso_id = ? AND g.sede_id = ?
       ORDER BY s.fecha DESC, s.hora_inicio, s.id`,
      [context.curso_id, context.sede_id]
    );
  return { recuperaciones, sesiones };
}

router.get("/recuperaciones", async (req, res) => {
  try {
    const { recuperaciones, sesiones } = await listControlRecoveries(req.user);
    res.json({ ok: true, recuperaciones, sesiones });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/recuperaciones/:id", async (req, res) => {
  let connection;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) fail(400, "Recuperacion no valida");
    const fields = ["estado", "fecha_recuperacion", "sesion_recuperacion_id", "observaciones"];
    if (!fields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      fail(400, "No hay campos para actualizar");
    }
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    await requireStaffProfessor(connection, req.user);
    const context = await getContext(connection);
    const [rows] = await connection.query(
      `SELECT r.id, r.estado, r.fecha_recuperacion, r.sesion_origen_id,
              r.sesion_recuperacion_id, r.observaciones
       FROM recuperaciones_clase r
       JOIN grupos g ON g.id = r.grupo_id
         AND g.curso_id = ? AND g.sede_id = ?
       WHERE r.id = ? LIMIT 1 FOR UPDATE`,
      [context.curso_id, context.sede_id, id]
    );
    const recovery = rows[0];
    if (!recovery) fail(404, "Recuperacion no encontrada en el curso actual");

    const estado = req.body.estado ?? recovery.estado;
    if (!RECOVERY_STATES.has(estado)) fail(400, "Estado de recuperacion no valido");
    let fecha = Object.prototype.hasOwnProperty.call(req.body, "fecha_recuperacion")
      ? (req.body.fecha_recuperacion || null) : recovery.fecha_recuperacion;
    fecha = dateOnly(fecha);
    if (fecha) validDate(fecha);
    let targetId = Object.prototype.hasOwnProperty.call(req.body, "sesion_recuperacion_id")
      ? (req.body.sesion_recuperacion_id || null) : recovery.sesion_recuperacion_id;
    if (targetId != null) {
      targetId = Number(targetId);
      if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(recovery.sesion_origen_id)) {
        fail(400, "Selecciona otra sesion valida para la recuperacion");
      }
      const [targets] = await connection.query(
        `SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha
         FROM sesiones_clase s
         JOIN grupos g ON g.id = s.grupo_id
           AND g.curso_id = ? AND g.sede_id = ?
         WHERE s.id = ? LIMIT 1`,
        [context.curso_id, context.sede_id, targetId]
      );
      if (!targets.length) fail(400, "La sesion de recuperacion no pertenece al curso actual");
      if (fecha && fecha !== targets[0].fecha) {
        fail(400, "La fecha no coincide con la sesion de recuperacion");
      }
      fecha = targets[0].fecha;
    }
    if ((estado === "asignada" || estado === "recuperada") && !fecha) {
      fail(400, "Indica la fecha de recuperacion");
    }
    const observaciones = Object.prototype.hasOwnProperty.call(req.body, "observaciones")
      ? req.body.observaciones : recovery.observaciones;
    await connection.query(
      `UPDATE recuperaciones_clase
       SET estado = ?, fecha_recuperacion = ?, sesion_recuperacion_id = ?, observaciones = ?
       WHERE id = ?`,
      [estado, fecha, targetId, observaciones, id]
    );
    await connection.commit();
    res.json({ ok: true, id, estado, fecha_recuperacion: fecha, sesion_recuperacion_id: targetId });
  } catch (error) {
    if (connection) await connection.rollback();
    sendError(res, error);
  } finally {
    connection?.release();
  }
});

export async function saveControlSession({ user, groupId, fecha, payload = {}, sessionId = null }) {
  let connection;
  try {
    const normalizedDate = String(fecha || "");
    const day = validDate(normalizedDate);
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const { group, context, professorId: linkedProfessorId } = await getGroup(connection, user, groupId, true);
    if (day !== group.dia1 && day !== group.dia2) fail(400, "El grupo no tiene clase en ese dia");
    const alumnos = await getRoster(connection, group, context, day);
    const allowed = new Set(alumnos.map((alumno) => Number(alumno.id)));
    const entries = payload.asistencias;
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
    if (payload.estado !== undefined && !SESSION_STATES.has(payload.estado)) fail(400, "Estado de sesion no valido");
    const hasProfessorId = Object.prototype.hasOwnProperty.call(payload, "profesor_id");
    const isAdmin = String(user?.rol).toLowerCase() === "admin";
    const professorId = hasProfessorId && payload.profesor_id !== "" && payload.profesor_id != null
      ? Number(payload.profesor_id)
      : isAdmin ? (hasProfessorId ? null : undefined) : linkedProfessorId;
    if (hasProfessorId && professorId !== null && professorId !== linkedProfessorId) {
      if (!Number.isInteger(professorId) || professorId <= 0) fail(400, "Profesor no valido");
      const [professors] = await connection.query("SELECT id FROM profesores WHERE id = ? LIMIT 1", [professorId]);
      if (!professors.length) fail(400, "Profesor no encontrado");
    }
    let sesion = await getSession(connection, group.id, normalizedDate, true);
    if (sessionId && Number(sesion?.id) !== Number(sessionId)) fail(404, "Sesion no encontrada");
    if (!sesion) {
      const [inserted] = await connection.query(
        `INSERT INTO sesiones_clase
         (grupo_id, profesor_id, fecha, hora_inicio, hora_fin, estado, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [group.id, professorId ?? null,
          normalizedDate, group.hora_inicio, endTime(group.hora_inicio, group.duracion_min),
          payload.estado || "programada", payload.observaciones ?? null]
      );
      sesion = { id: inserted.insertId };
    } else if (entries !== undefined || professorId !== undefined || payload.estado !== undefined || payload.observaciones !== undefined) {
      await connection.query(
        `UPDATE sesiones_clase SET profesor_id = ?, estado = ?, observaciones = ? WHERE id = ?`,
        [professorId === undefined ? sesion.profesor_id : professorId,
          payload.estado ?? sesion.estado, payload.observaciones === undefined ? sesion.observaciones : payload.observaciones,
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
    sesion = await getSession(connection, group.id, normalizedDate);
    const asistencias = await getAttendance(connection, sesion.id);
    await syncRecoveries(connection, sesion, asistencias);
    await connection.commit();
    return { sesion, alumnos, asistencias, dia: day };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection?.release();
  }
}

async function saveRequest(req, res, sessionId = null) {
  try {
    const result = await saveControlSession({
      user: req.user,
      groupId: req.params.grupoId,
      fecha: req.body.fecha,
      payload: req.body,
      sessionId,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
}

router.post("/grupos/:grupoId/sesiones", (req, res) => saveRequest(req, res));
router.put("/grupos/:grupoId/sesiones/:sesionId/asistencia", (req, res) => saveRequest(req, res, req.params.sesionId));

export default router;
