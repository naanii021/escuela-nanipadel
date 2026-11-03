import { db } from "../db/connection.js";
import { getContext } from "../routes/gestionControl.js";
import { normalizePhoneNumber } from "./whatsappService.js";

// Asistente de WhatsApp para alumnos y familias. Solo consultas de lectura por reglas;
// la BD es siempre la fuente de verdad y cada mensaje vuelve a comprobar el teléfono.

export const ASSISTANT_TABLE = "whatsapp_conversacion_alumno";
const DATA_INTENTS = new Set(["horario", "grupo", "recuperaciones"]);
const DAY_NAMES = { L: "lunes", M: "martes", X: "miércoles", J: "jueves", V: "viernes", S: "sábado", D: "domingo" };
const PHONE_COLUMNS = ["telefono", "tutor_telefono"];

const UNKNOWN_PHONE = "Hola. No encontramos ningún alumno de la escuela asociado a este número, así que no podemos mostrarte información. "
  + "Contacta con la escuela para revisar tus datos.";
const HELP = "Puedo ayudarte con:\n"
  + "• ¿Cuándo tengo clase? (horario)\n"
  + "• ¿En qué grupo estoy?\n"
  + "• ¿Tengo recuperaciones?";
const SWITCH_HINT = "\nSi quieres consultar a otro alumno, escribe \"cambiar alumno\".";

export function assistantEnabled() {
  return String(process.env.WHATSAPP_ASSISTANT_ENABLED || "").toLowerCase() === "true";
}

export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectIntent(text) {
  const t = normalizeText(text);
  if (!t) return null;
  if (/^cambiar$|\b(cambiar|cambia|otro|otra)\b.*\b(alumn|hij|herman)/.test(t)) return "cambiar";
  if (/recupera/.test(t)) return "recuperaciones";
  if (/\bgrupos?\b/.test(t)) return "grupo";
  if (/horario|cuando (tengo|hay|es|son|me toca)|a que hora|que dias?\b|tengo clase|mis clases|proxima clase/.test(t)) return "horario";
  if (/^(hola|buenas|buenos|hey|ayuda|menu|info)\b|\bayuda\b|que puedes hacer/.test(t)) return "ayuda";
  return null;
}

function fullName(student) {
  return `${student.nombre || ""} ${student.apellidos || ""}`.trim();
}

function formatDate(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "sin fecha";
}

function timeRange(start, minutes) {
  const [hours, mins] = String(start || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "sin hora";
  const end = hours * 60 + mins + Number(minutes || 60);
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}–${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`;
}

function groupDays(group) {
  const days = [];
  if (group.dia1 && Number(group.asiste_dia1 ?? 1) === 1) days.push(group.dia1);
  if (group.dia2 && Number(group.asiste_dia2 ?? 1) === 1) days.push(group.dia2);
  return days.map((day) => DAY_NAMES[day] || day).join(" y ") || "sin días asignados";
}

const cleanedPhone = (column) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '')`;

export function createWhatsAppAssistant({ database = db } = {}) {
  const promiseDb = () => database.promise();
  let phoneColumnsPromise = null;

  function getPhoneColumns(connection) {
    if (!phoneColumnsPromise) {
      phoneColumnsPromise = connection.query("SHOW COLUMNS FROM alumnos")
        .then(([rows]) => {
          const names = new Set(rows.map((row) => row.Field));
          return PHONE_COLUMNS.filter((column) => names.has(column));
        })
        .catch((error) => {
          phoneColumnsPromise = null;
          throw error;
        });
    }
    return phoneColumnsPromise;
  }

  // El LIKE solo preselecciona; la coincidencia exacta se decide con el mismo normalizador.
  async function findStudentsByPhone(connection, context, phone) {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return [];
    const columns = await getPhoneColumns(connection);
    if (!columns.length) return [];
    const suffix = `%${normalized.replace(/\D/g, "").slice(-9)}`;
    const [rows] = await connection.query(
      `SELECT a.id, a.nombre, a.apellidos, ${columns.map((column) => `a.${column}`).join(", ")}
       FROM alumnos a
       JOIN alumno_curso ac ON ac.alumno_id = a.id
         AND ac.curso_id = ? AND ac.sede_id = ? AND COALESCE(ac.estado, '') <> 'baja'
       WHERE a.activo = 1 AND (${columns.map((column) => `${cleanedPhone(`a.${column}`)} LIKE ?`).join(" OR ")})
       ORDER BY a.nombre, a.apellidos, a.id`,
      [context.curso_id, context.sede_id, ...columns.map(() => suffix)]
    );
    const students = new Map();
    for (const row of rows) {
      if (columns.some((column) => normalizePhoneNumber(row[column]) === normalized)) {
        students.set(Number(row.id), { id: Number(row.id), nombre: row.nombre, apellidos: row.apellidos });
      }
    }
    return [...students.values()];
  }

  async function getSelection(connection, conversationId) {
    const [rows] = await connection.query(
      `SELECT alumno_id, intencion_pendiente FROM ${ASSISTANT_TABLE} WHERE conversation_id = ? LIMIT 1`,
      [conversationId]
    );
    return rows[0] || null;
  }

  async function saveSelection(connection, conversationId, alumnoId, pendingIntent) {
    await connection.query(
      `INSERT INTO ${ASSISTANT_TABLE} (conversation_id, alumno_id, intencion_pendiente)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE alumno_id = VALUES(alumno_id), intencion_pendiente = VALUES(intencion_pendiente)`,
      [conversationId, alumnoId, pendingIntent]
    );
  }

  async function studentGroups(connection, context, studentId) {
    const [rows] = await connection.query(
      `SELECT g.id, g.codigo, g.nombre, g.nivel, g.dia1, g.dia2, g.hora_inicio, g.duracion_min,
              g.pista_habitual, ga.asiste_dia1, ga.asiste_dia2
       FROM grupo_alumnos ga
       JOIN grupos g ON g.id = ga.grupo_id AND g.activo = 1 AND g.curso_id = ? AND g.sede_id = ?
       WHERE ga.alumno_id = ? AND ga.activo = 1
       ORDER BY g.hora_inicio, g.nombre`,
      [context.curso_id, context.sede_id, studentId]
    );
    return rows;
  }

  async function studentRecoveries(connection, context, studentId) {
    const [rows] = await connection.query(
      `SELECT r.id, r.estado,
              DATE_FORMAT(r.fecha_original, '%Y-%m-%d') AS fecha_original,
              DATE_FORMAT(r.fecha_recuperacion, '%Y-%m-%d') AS fecha_recuperacion,
              g.nombre AS grupo_nombre
       FROM recuperaciones_clase r
       JOIN grupos g ON g.id = r.grupo_id AND g.curso_id = ? AND g.sede_id = ?
       WHERE r.alumno_id = ? AND r.estado IN ('pendiente', 'asignada')
       ORDER BY r.fecha_original, r.id`,
      [context.curso_id, context.sede_id, studentId]
    );
    return rows;
  }

  async function answer(connection, context, intent, student, siblings) {
    const name = fullName(student);
    const hint = siblings ? SWITCH_HINT : "";
    if (intent === "horario") {
      const groups = await studentGroups(connection, context, student.id);
      if (!groups.length) return `${name} no tiene grupo asignado en el curso actual. Si crees que es un error, contacta con la escuela.`;
      const lines = groups.map((group) =>
        `• ${group.nombre || group.codigo}: ${groupDays(group)} · ${timeRange(group.hora_inicio, group.duracion_min)} · ${group.pista_habitual || "pista por confirmar"}`);
      return `Horario de ${name}:\n${lines.join("\n")}${hint}`;
    }
    if (intent === "grupo") {
      const groups = await studentGroups(connection, context, student.id);
      if (!groups.length) return `${name} no tiene grupo asignado en el curso actual. Si crees que es un error, contacta con la escuela.`;
      const lines = groups.map((group) => `• ${group.nombre || group.codigo}${group.nivel ? ` (nivel ${group.nivel})` : ""}`);
      return `${name} está en:\n${lines.join("\n")}${hint}`;
    }
    if (intent === "recuperaciones") {
      const recoveries = await studentRecoveries(connection, context, student.id);
      if (!recoveries.length) return `${name} no tiene recuperaciones pendientes ni asignadas.${hint}`;
      const lines = recoveries.map((item) => {
        const detail = item.estado === "asignada" && item.fecha_recuperacion
          ? `asignada para el ${formatDate(item.fecha_recuperacion)}` : item.estado;
        return `• Clase del ${formatDate(item.fecha_original)} (${item.grupo_nombre}) · ${detail}`;
      });
      return `Recuperaciones de ${name}:\n${lines.join("\n")}${hint}`;
    }
    const opening = intent === "ayuda" ? `Hola, consultando los datos de ${name}.` : "No he entendido la consulta.";
    return `${opening}\n${HELP}${hint}`;
  }

  function selectionPrompt(students) {
    const options = students.map((student, index) => `${index + 1}. ${fullName(student)}`);
    return `Este número está asociado a varios alumnos. ¿Sobre quién quieres consultar?\n${options.join("\n")}\n`
      + "Responde con el número o el nombre.";
  }

  function parseSelection(text, students) {
    const t = normalizeText(text);
    if (/^\d+$/.test(t)) return students[Number(t) - 1] || null;
    const tokens = new Set(t.split(" "));
    const matches = students.filter((student) => {
      const full = normalizeText(fullName(student));
      const first = normalizeText(student.nombre).split(" ")[0];
      return t === full || (full && t.includes(full)) || (first && tokens.has(first));
    });
    return matches.length === 1 ? matches[0] : null;
  }

  async function reply({ conversationId, phone, text }) {
    const connection = promiseDb();
    const context = await getContext(connection);
    const students = await findStudentsByPhone(connection, context, phone);
    if (!students.length) return UNKNOWN_PHONE;

    const intent = detectIntent(text);
    if (students.length === 1) return answer(connection, context, intent, students[0], false);

    const saved = await getSelection(connection, conversationId);
    // Una selección guardada solo vale si el alumno sigue vinculado a este teléfono en la BD.
    const selected = saved && students.find((student) => student.id === Number(saved.alumno_id));
    if (selected && intent !== "cambiar") return answer(connection, context, intent, selected, true);

    if (!selected && !intent) {
      const chosen = parseSelection(text, students);
      if (chosen) {
        const pending = DATA_INTENTS.has(saved?.intencion_pendiente) ? saved.intencion_pendiente : null;
        await saveSelection(connection, conversationId, chosen.id, null);
        return `Perfecto, ahora consultamos a ${fullName(chosen)}.\n\n${await answer(connection, context, pending || "ayuda", chosen, true)}`;
      }
    }

    const pending = DATA_INTENTS.has(intent) ? intent
      : intent === "cambiar" ? null : (saved?.intencion_pendiente ?? null);
    await saveSelection(connection, conversationId, null, pending);
    return selectionPrompt(students);
  }

  return { reply };
}
