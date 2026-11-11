import { db } from "../db/connection.js";
import {
  listControlGroups,
  listControlRecoveries,
  loadControlSession,
  saveControlSession,
} from "../routes/gestionControl.js";
import { consumeTelegramLinkCode, getTelegramProfessor } from "./telegramLinkService.js";

const SIN_CAMBIOS_VISTOS = "1970-01-01T00:00:00.000Z";
const DAY_CODES = ["D", "L", "M", "X", "J", "V", "S"];
const STATUS = { presente: "✅", falta: "❌", justificada: "🟠" };
const HELP_TEXT = [
  "Esto puedes hacer:",
  "",
  "/hoy · tus clases de hoy y pasar lista",
  "/grupos · todos tus grupos",
  "/recuperaciones · alumnos que tienen que recuperar",
  "/ayuda · ver este mensaje",
  "",
  "Para pasar lista: pulsa /hoy, elige la clase y toca «Pasar lista». Todos salen como presentes: cambia solo los que no han venido (P = presente, F = falta, J = falta justificada) y pulsa «Guardar lista».",
].join("\n");
const NOT_LINKED_TEXT = "Este chat todavía no está vinculado. Entra en la web de la escuela, abre «Panel», busca «Pasar lista por Telegram», genera el código y envíamelo así: /start CÓDIGO";
export const DRAFT_TTL_MS = 60 * 60 * 1000;
const DRAFT_NOTICES = {
  lost: "⚠️ La lista en curso se ha perdido (el bot se ha reiniciado). No se ha guardado nada: vuelve a pasar lista y pulsa Guardar.",
  expired: "⚠️ La lista en curso ha caducado por inactividad. No se ha guardado nada: vuelve a pasar lista y pulsa Guardar.",
};

function madridDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function dayCode(date) {
  return DAY_CODES[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function nextGroupDate(group, startDate) {
  const date = new Date(`${startDate}T12:00:00Z`);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(date);
    candidate.setUTCDate(date.getUTCDate() + offset);
    const value = candidate.toISOString().slice(0, 10);
    if (group.dia1 === dayCode(value) || group.dia2 === dayCode(value)) return value;
  }
  return startDate;
}

function isAdminProfessor(professor) {
  return String(professor?.usuario_rol || "").toLowerCase() === "admin";
}

// El admin vinculado ve todos los grupos; el profesor, solo los suyos (se filtra en canUseGroup).
function actor(professor) {
  return {
    id: professor.usuario_id || professor.id,
    rol: isAdminProfessor(professor) ? "admin" : "profesor",
    profesor_id: professor.id,
  };
}

// Un grupo compartido lo ven y gestionan todos sus profesores (el principal y los de profesores_ids).
function canUseGroup(professor, group) {
  if (isAdminProfessor(professor)) return true;
  const id = Number(professor.id);
  return Number(group?.profesor_id) === id || (group?.profesores_ids || []).some((other) => Number(other) === id);
}

// Si otro profesor ya pasó lista de esta clase, se le avisa en llano antes de ofrecer los botones.
function avisoListaDeCompanero(professor, session) {
  const ultimo = session?.ultimo_cambio;
  if (!ultimo?.hay_asistencia || !ultimo.profesor_id || Number(ultimo.profesor_id) === Number(professor.id)) return "";
  const nombre = String(ultimo.profesor || "").split(/\s+/)[0] || "Un compañero";
  const hora = ultimo.en
    ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ultimo.en))
    : null;
  const presentes = Number(ultimo.resumen?.presente) || 0;
  const ausentes = (Number(ultimo.resumen?.falta) || 0) + (Number(ultimo.resumen?.justificada) || 0);
  const partes = [`${presentes} ${presentes === 1 ? "vino" : "vinieron"}`];
  if (ausentes) partes.push(`${ausentes} ${ausentes === 1 ? "faltó" : "faltaron"}`);
  return `Ojo: ${nombre} ya pasó lista${hora ? ` a las ${hora}` : ""}: ${partes.join(", ")}. Si guardas, la cambiarás.`;
}

function callbackButton(text, callback_data) {
  return { text, callback_data };
}

function groupKeyboard(groupId, date) {
  return [[
    callbackButton("Ver alumnos", `students:${groupId}:${date}`),
  ], [callbackButton("Pasar lista", `attendance:${groupId}:${date}`)]];
}

function canceledLine(session) {
  const c = session?.cancelacion;
  return `🚫 Clase cancelada: ${c?.etiqueta || "otro motivo"}${c?.texto ? ` (${c.texto})` : ""}`;
}

function groupText(group, students = null, session = null) {
  if (session?.estado === "cancelada") {
    const time = String(group.hora_inicio || "").slice(0, 5) || "Sin hora";
    return `🔴 ${time} · ${group.nombre || group.codigo}\n${canceledLine(session)}\nNo hay que pasar lista. Si se da al final, se reabre desde el panel de la web.`;
  }
  const time = String(group.hora_inicio || "").slice(0, 5) || "Sin hora";
  const court = group.pista_habitual || "sin pista";
  const pupils = students ? `\nAlumnos: ${students.map((item) => `${item.nombre} ${item.apellidos || ""}`.trim()).join(", ") || "ninguno"}` : "";
  return `🟢 ${time} · ${group.nombre || group.codigo}\n📍 ${court}${pupils}`;
}

export class TelegramApi {
  constructor(token, fetchImpl = fetch) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.fetch = fetchImpl;
  }

  async call(method, body = {}) {
    const response = await this.fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} fallo`);
    return data.result;
  }

  sendMessage(chatId, text, reply_markup) {
    return this.call("sendMessage", { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) });
  }

  editMessage(chatId, messageId, text, reply_markup) {
    return this.call("editMessageText", { chat_id: chatId, message_id: messageId, text, ...(reply_markup ? { reply_markup } : {}) });
  }

  answerCallback(id, text) {
    return this.call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
  }

  setCommands(commands) {
    return this.call("setMyCommands", { commands });
  }

  getUpdates(offset, timeout = 25) {
    return this.call("getUpdates", { offset, timeout, allowed_updates: ["message", "callback_query"] });
  }
}

export function createTelegramBot({ api, database = db, now = () => new Date(), draftTtlMs = DRAFT_TTL_MS }) {
  const drafts = new Map();
  const nowMs = () => now().getTime();
  const isExpired = (draft) => nowMs() - draft.touchedAt > draftTtlMs;

  function pruneExpiredDrafts() {
    for (const [key, draft] of drafts) {
      if (isExpired(draft)) drafts.delete(key);
    }
  }

  function takeDraft(key) {
    const draft = drafts.get(key);
    if (!draft) return { reason: "lost" };
    if (isExpired(draft)) {
      drafts.delete(key);
      return { reason: "expired" };
    }
    draft.touchedAt = nowMs();
    return { draft };
  }
  const promiseDb = () => database.promise();

  async function linked(chatId) {
    return getTelegramProfessor(chatId, promiseDb());
  }

  async function requireLinked(chatId) {
    const professor = await linked(chatId);
    if (!professor) {
      await api.sendMessage(chatId, NOT_LINKED_TEXT);
    }
    return professor;
  }

  async function showGroups(chatId, professor, onlyToday = false) {
    const date = madridDate(now());
    const { grupos } = await listControlGroups(actor(professor), promiseDb());
    const own = grupos.filter((group) => canUseGroup(professor, group));
    const selected = onlyToday ? own.filter((group) => group.dia1 === dayCode(date) || group.dia2 === dayCode(date)) : own;
    if (!selected.length) {
      return api.sendMessage(chatId, onlyToday ? "Hoy no tienes clases. 🎾" : "No tienes grupos asignados todavía. Pídele a la administración que te los asigne.");
    }
    await api.sendMessage(chatId, onlyToday ? `Clases de hoy (${date}): ${selected.length}` : `Tus grupos: ${selected.length}`);
    for (const group of selected) {
      const classDate = onlyToday ? date : nextGroupDate(group, date);
      const data = await loadControlSession(actor(professor), group.id, classDate, promiseDb());
      const heading = onlyToday ? "" : `Próxima clase: ${classDate}\n`;
      const canceled = data.sesiones[0]?.estado === "cancelada";
      await api.sendMessage(chatId, `${heading}${groupText(group, data.alumnos, data.sesiones[0])}`,
        canceled ? undefined : { inline_keyboard: groupKeyboard(group.id, classDate) });
    }
  }

  async function showRecoveries(chatId, professor) {
    const { recuperaciones } = await listControlRecoveries(actor(professor), promiseDb());
    const { grupos } = await listControlGroups(actor(professor), promiseDb());
    const ownGroupIds = new Set(grupos.filter((group) => canUseGroup(professor, group)).map((group) => Number(group.id)));
    const pending = recuperaciones.filter((item) => item.estado === "pendiente" || item.estado === "asignada");
    const own = isAdminProfessor(professor) ? pending : pending.filter((item) => ownGroupIds.has(Number(item.grupo_id)));
    if (!own.length) return api.sendMessage(chatId, "No hay recuperaciones pendientes. 👍");
    const lines = own.map((item) => {
      const assigned = item.fecha_recuperacion ? ` → ${item.fecha_recuperacion}` : "";
      return `• ${item.alumno_nombre || "Alumno"} ${item.alumno_apellidos || ""} · ${item.grupo_origen} · ${item.fecha_original} · ${item.estado}${assigned}`;
    });
    return api.sendMessage(chatId, `Recuperaciones pendientes:\n${lines.join("\n")}`);
  }

  function draftMessage(draft, notice = "") {
    const lines = draft.students.map((student) => {
      const state = draft.states[student.id] || "presente";
      return `${STATUS[state]} ${student.nombre} ${student.apellidos || ""}`.trim();
    });
    return `${notice ? `${notice}\n\n` : ""}Lista · ${draft.group.nombre} · ${draft.date}\nToca la letra de quien NO haya venido normal. P = presente, F = falta, J = justificada.\n\n${lines.join("\n")}`;
  }

  function draftKeyboard(draft) {
    const rows = draft.students.map((student) => {
      const current = draft.states[student.id] || "presente";
      const prefix = `${draft.group.id}:${draft.compactDate}:${student.id}`;
      return [
        callbackButton(`${current === "presente" ? "● " : ""}P`, `mark:${prefix}:p`),
        callbackButton(`${current === "falta" ? "● " : ""}F`, `mark:${prefix}:f`),
        callbackButton(`${current === "justificada" ? "● " : ""}J`, `mark:${prefix}:j`),
      ];
    });
    rows.push([callbackButton("Guardar lista", `save:${draft.group.id}:${draft.compactDate}`)]);
    return { inline_keyboard: rows };
  }

  // El servidor ya impide cargar un grupo ajeno (403 "no es tuyo"); aquí se convierte en el aviso amable del bot.
  async function cargarSesion(professor, groupId, date) {
    try {
      return await loadControlSession(actor(professor), groupId, date, promiseDb());
    } catch (error) {
      if (error.status === 403 && /no es tuyo/.test(String(error.message))) return null;
      throw error;
    }
  }

  function denyForeignGroup(chatId, messageId = null) {
    const text = "Ese grupo no es tuyo, así que no puedes pasar lista. Si lo estás sustituyendo, pídele a la administración que te lo asigne.";
    return messageId ? api.editMessage(chatId, messageId, text) : api.sendMessage(chatId, text);
  }

  async function beginAttendance(chatId, professor, groupId, date, messageId = null, notice = "") {
    const data = await cargarSesion(professor, groupId, date);
    if (!data || !canUseGroup(professor, data.grupo)) return denyForeignGroup(chatId, messageId);
    if (data.sesiones[0]?.estado === "cancelada") {
      drafts.delete(`${chatId}:${groupId}:${date.replaceAll("-", "")}`);
      const text = groupText(data.grupo, null, data.sesiones[0]);
      return messageId ? api.editMessage(chatId, messageId, text) : api.sendMessage(chatId, text);
    }
    const group = { ...data.grupo, id: Number(groupId) };
    const stored = Object.fromEntries(data.asistencias.map((item) => [item.alumno_id, item.estado]));
    const aviso = avisoListaDeCompanero(professor, data.sesiones[0]);
    const draft = {
      group, date, compactDate: date.replaceAll("-", ""), students: data.alumnos,
      // Sin sesión todavía se manda "no he visto nada" (1970): si un compañero guarda antes, no se pisa.
      baseCambio: data.sesiones[0]?.ultimo_cambio?.en ?? SIN_CAMBIOS_VISTOS,
      states: Object.fromEntries(data.alumnos.map((student) => [student.id, stored[student.id] || "presente"])),
      messageId, touchedAt: nowMs(),
    };
    drafts.set(`${chatId}:${groupId}:${draft.compactDate}`, draft);
    const markup = draftKeyboard(draft);
    const avisos = [notice, aviso].filter(Boolean).join("\n\n");
    if (messageId) return api.editMessage(chatId, messageId, draftMessage(draft, avisos), markup);
    const sent = await api.sendMessage(chatId, draftMessage(draft, avisos), markup);
    draft.messageId = sent?.message_id ?? null;
    return sent;
  }

  async function handleMessage(message) {
    const chatId = message.chat?.id;
    if (!chatId || message.chat?.type !== "private") return;
    const [rawCommand = "", argument = ""] = String(message.text || "").trim().split(/\s+/, 2);
    const command = rawCommand.split("@")[0].toLowerCase();
    if (command === "/start") {
      if (argument) {
        const professor = await consumeTelegramLinkCode({
          code: argument, chatId, username: message.from?.username,
        }, promiseDb());
        if (professor) return api.sendMessage(chatId, `¡Listo, ${professor.nombre || "profe"}! Telegram queda vinculado.\n\nEscribe /hoy para ver tus clases y pasar lista. Si te pierdes, escribe /ayuda.`);
        return api.sendMessage(chatId, "Ese código no vale: ha caducado (dura 10 minutos) o ya se usó. Genera uno nuevo en el panel de la web y envíamelo otra vez.");
      }
      const professor = await linked(chatId);
      return api.sendMessage(chatId, professor
        ? `Hola, ${professor.nombre || "profe"}. Escribe /hoy para pasar lista o /ayuda para ver qué puedo hacer.`
        : NOT_LINKED_TEXT);
    }
    if (command === "/ayuda" || command === "/help") {
      return api.sendMessage(chatId, (await linked(chatId)) ? HELP_TEXT : NOT_LINKED_TEXT);
    }
    const professor = await requireLinked(chatId);
    if (!professor) return;
    if (command === "/hoy") return showGroups(chatId, professor, true);
    if (command === "/grupos") return showGroups(chatId, professor, false);
    if (command === "/recuperaciones") return showRecoveries(chatId, professor);
    return api.sendMessage(chatId, HELP_TEXT);
  }

  async function handleCallback(callback) {
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (!chatId) return;
    const professor = await requireLinked(chatId);
    if (!professor) return api.answerCallback(callback.id, "Chat sin vincular");
    const parts = String(callback.data || "").split(":");
    const action = parts[0];
    const groupId = Number(parts[1]);
    const compactDate = parts[2];
    const date = /^\d{8}$/.test(compactDate)
      ? `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6)}` : compactDate;
    if (!Number.isInteger(groupId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      return api.answerCallback(callback.id, "Acción no válida");
    }
    if (action === "open" || action === "students") {
      const data = await cargarSesion(professor, groupId, date);
      await api.answerCallback(callback.id);
      if (!data || !canUseGroup(professor, data.grupo)) return denyForeignGroup(chatId);
      const canceled = data.sesiones[0]?.estado === "cancelada";
      return api.sendMessage(chatId, groupText(data.grupo, data.alumnos, data.sesiones[0]),
        canceled ? undefined : { inline_keyboard: groupKeyboard(groupId, date) });
    }
    if (action === "attendance") {
      await api.answerCallback(callback.id);
      return beginAttendance(chatId, professor, groupId, date, messageId);
    }
    if (action !== "mark" && action !== "save") return api.answerCallback(callback.id, "Acción no reconocida");
    const key = `${chatId}:${groupId}:${date.replaceAll("-", "")}`;
    const { draft, reason } = takeDraft(key);
    if (!draft) {
      // Sin borrador nunca se guarda: se recarga la lista en el mismo mensaje para repasarla entera.
      await api.answerCallback(callback.id, reason === "expired" ? "Lista caducada" : "Lista perdida, vuelve a pasarla");
      return beginAttendance(chatId, professor, groupId, date, messageId, DRAFT_NOTICES[reason]);
    }
    if (action === "mark") {
      const studentId = Number(parts[3]);
      const state = { p: "presente", f: "falta", j: "justificada" }[parts[4]];
      if (!draft.students.some((student) => Number(student.id) === studentId) || !state) {
        return api.answerCallback(callback.id, "Alumno o estado no válido");
      }
      draft.states[studentId] = state;
      await api.answerCallback(callback.id, `${state}`);
      return api.editMessage(chatId, messageId || draft.messageId, draftMessage(draft), draftKeyboard(draft));
    }
    if (action === "save") {
      let result;
      try {
        result = await saveControlSession({
          user: actor(professor), groupId, fecha: date,
          payload: {
            estado: "dada", profesor_id: professor.id, base_cambio: draft.baseCambio,
            asistencias: draft.students.map((student) => ({ alumno_id: student.id, estado: draft.states[student.id] })),
          },
        });
      } catch (error) {
        // La clase se canceló mientras se pasaba lista: se avisa en vez de dejar el botón sin respuesta.
        if (error.status === 403) {
          drafts.delete(key);
          await api.answerCallback(callback.id, "No se ha guardado");
          return denyForeignGroup(chatId, messageId || draft.messageId);
        }
        // Un compañero guardó la clase mientras se pasaba lista: no se pisa; se recarga la lista con lo suyo.
        if (error.status === 409 && error.extra?.conflicto) {
          drafts.delete(key);
          await api.answerCallback(callback.id, "No se ha guardado");
          return beginAttendance(chatId, professor, groupId, date, messageId || draft.messageId,
            "⚠️ No se ha guardado: un compañero acaba de cambiar esta clase.");
        }
        if (error.status !== 400) throw error;
        drafts.delete(key);
        await api.answerCallback(callback.id, "No se ha guardado");
        return api.editMessage(chatId, messageId || draft.messageId, `⚠️ ${error.message}`);
      }
      drafts.delete(key);
      const counts = result.asistencias.reduce((acc, item) => ({ ...acc, [item.estado]: (acc[item.estado] || 0) + 1 }), {});
      await api.answerCallback(callback.id, "Asistencia guardada");
      return api.editMessage(chatId, messageId || draft.messageId,
        `✅ Lista guardada. La clase queda como dada.\nPresentes: ${counts.presente || 0} · Faltas: ${counts.falta || 0} · Justificadas: ${counts.justificada || 0}`);
    }
  }

  async function handleUpdate(update) {
    pruneExpiredDrafts();
    if (update.message) return handleMessage(update.message);
    if (update.callback_query) return handleCallback(update.callback_query);
  }

  return { handleUpdate, handleMessage, handleCallback, drafts, pruneExpiredDrafts };
}

export async function runTelegramPolling({ api, bot, onError = console.error }) {
  let offset = 0;
  let stopped = false;
  return {
    async start() {
      while (!stopped) {
        try {
          const updates = await api.getUpdates(offset);
          for (const update of updates) {
            offset = Math.max(offset, Number(update.update_id) + 1);
            try {
              await bot.handleUpdate(update);
            } catch (error) {
              onError("Error procesando actualización de Telegram:", error);
            }
          }
        } catch (error) {
          onError("Error en polling de Telegram:", error);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    },
    stop() { stopped = true; },
  };
}

export const BOT_COMMANDS = [
  { command: "hoy", description: "Mis clases de hoy y pasar lista" },
  { command: "grupos", description: "Mis grupos" },
  { command: "recuperaciones", description: "Recuperaciones pendientes" },
  { command: "ayuda", description: "Cómo funciona" },
];

export { madridDate };
