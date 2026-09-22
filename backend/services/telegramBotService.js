import { db } from "../db/connection.js";
import {
  listControlGroups,
  listControlRecoveries,
  loadControlSession,
  saveControlSession,
} from "../routes/gestionControl.js";
import { consumeTelegramLinkCode, getTelegramProfessor } from "./telegramLinkService.js";

const DAY_CODES = ["D", "L", "M", "X", "J", "V", "S"];
const STATUS = { presente: "✅", falta: "❌", justificada: "🟠" };

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

function actor(professor) {
  return { id: professor.usuario_id || professor.id, rol: "profesor", profesor_id: professor.id };
}

function callbackButton(text, callback_data) {
  return { text, callback_data };
}

function groupKeyboard(groupId, date) {
  return [[
    callbackButton("Abrir clase", `open:${groupId}:${date}`),
    callbackButton("Ver alumnos", `students:${groupId}:${date}`),
  ], [callbackButton("Pasar lista", `attendance:${groupId}:${date}`)]];
}

function groupText(group, students = null) {
  const time = String(group.hora_inicio || "").slice(0, 5) || "Sin hora";
  const court = group.pista_habitual || "Sin pista";
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

  getUpdates(offset, timeout = 25) {
    return this.call("getUpdates", { offset, timeout, allowed_updates: ["message", "callback_query"] });
  }
}

export function createTelegramBot({ api, database = db, now = () => new Date() }) {
  const drafts = new Map();
  const promiseDb = () => database.promise();

  async function linked(chatId) {
    return getTelegramProfessor(chatId, promiseDb());
  }

  async function requireLinked(chatId) {
    const professor = await linked(chatId);
    if (!professor) {
      await api.sendMessage(chatId, "Chat no vinculado. Genera un código desde tu sesión de profesor y envía /start CODIGO.");
    }
    return professor;
  }

  async function showGroups(chatId, professor, onlyToday = false) {
    const date = madridDate(now());
    const { grupos } = await listControlGroups(actor(professor), promiseDb());
    const selected = onlyToday ? grupos.filter((group) => group.dia1 === dayCode(date) || group.dia2 === dayCode(date)) : grupos;
    await api.sendMessage(chatId, onlyToday ? `Clases de hoy (${date}): ${selected.length}` : `Grupos activos: ${selected.length}`);
    if (!selected.length) return api.sendMessage(chatId, "No hay clases para hoy.");
    for (const group of selected) {
      const classDate = onlyToday ? date : nextGroupDate(group, date);
      const data = await loadControlSession(actor(professor), group.id, classDate, promiseDb());
      const heading = onlyToday ? "" : `Próxima clase: ${classDate}\n`;
      await api.sendMessage(chatId, `${heading}${groupText(group, data.alumnos)}`, { inline_keyboard: groupKeyboard(group.id, classDate) });
    }
  }

  async function showRecoveries(chatId, professor) {
    const { recuperaciones } = await listControlRecoveries(actor(professor), promiseDb());
    const pending = recuperaciones.filter((item) => item.estado === "pendiente" || item.estado === "asignada");
    if (!pending.length) return api.sendMessage(chatId, "No hay recuperaciones pendientes o asignadas.");
    const lines = pending.map((item) => {
      const assigned = item.fecha_recuperacion ? ` → ${item.fecha_recuperacion}` : "";
      return `• ${item.alumno_nombre || "Alumno"} ${item.alumno_apellidos || ""} · ${item.grupo_origen} · ${item.fecha_original} · ${item.estado}${assigned}`;
    });
    return api.sendMessage(chatId, `Recuperaciones:\n${lines.join("\n")}`);
  }

  function draftMessage(draft) {
    const lines = draft.students.map((student) => {
      const state = draft.states[student.id] || "presente";
      return `${STATUS[state]} ${student.nombre} ${student.apellidos || ""}`.trim();
    });
    return `Pasar lista · ${draft.group.nombre} · ${draft.date}\n${lines.join("\n")}`;
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

  async function beginAttendance(chatId, professor, groupId, date, messageId = null) {
    const data = await loadControlSession(actor(professor), groupId, date, promiseDb());
    const group = { ...data.grupo, id: Number(groupId) };
    const stored = Object.fromEntries(data.asistencias.map((item) => [item.alumno_id, item.estado]));
    const draft = {
      group, date, compactDate: date.replaceAll("-", ""), students: data.alumnos,
      states: Object.fromEntries(data.alumnos.map((student) => [student.id, stored[student.id] || "presente"])),
    };
    drafts.set(`${chatId}:${groupId}:${draft.compactDate}`, draft);
    const markup = draftKeyboard(draft);
    if (messageId) return api.editMessage(chatId, messageId, draftMessage(draft), markup);
    return api.sendMessage(chatId, draftMessage(draft), markup);
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
        if (professor) return api.sendMessage(chatId, `Telegram vinculado a ${professor.nombre || "tu perfil"}. Usa /hoy, /grupos o /recuperaciones.`);
        return api.sendMessage(chatId, "El código no es válido, ha caducado o ya fue utilizado.");
      }
      const professor = await linked(chatId);
      return api.sendMessage(chatId, professor
        ? "Bot de profesores activo. Usa /hoy, /grupos o /recuperaciones."
        : "Genera un código desde tu sesión autenticada de profesor y envía /start CODIGO.");
    }
    const professor = await requireLinked(chatId);
    if (!professor) return;
    if (command === "/hoy") return showGroups(chatId, professor, true);
    if (command === "/grupos") return showGroups(chatId, professor, false);
    if (command === "/recuperaciones") return showRecoveries(chatId, professor);
    return api.sendMessage(chatId, "Comandos: /hoy, /grupos, /recuperaciones");
  }

  async function handleCallback(callback) {
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (!chatId) return;
    const professor = await requireLinked(chatId);
    if (!professor) return api.answerCallback(callback.id, "Chat no vinculado");
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
      const data = await loadControlSession(actor(professor), groupId, date, promiseDb());
      await api.answerCallback(callback.id);
      return api.sendMessage(chatId, groupText(data.grupo, data.alumnos), { inline_keyboard: groupKeyboard(groupId, date) });
    }
    if (action === "attendance") {
      await api.answerCallback(callback.id);
      return beginAttendance(chatId, professor, groupId, date, messageId);
    }
    const key = `${chatId}:${groupId}:${compactDate}`;
    let draft = drafts.get(key);
    if (!draft) {
      await beginAttendance(chatId, professor, groupId, date);
      draft = drafts.get(key);
    }
    if (action === "mark") {
      const studentId = Number(parts[3]);
      const state = { p: "presente", f: "falta", j: "justificada" }[parts[4]];
      if (!draft.students.some((student) => Number(student.id) === studentId) || !state) {
        return api.answerCallback(callback.id, "Alumno o estado no válido");
      }
      draft.states[studentId] = state;
      await api.answerCallback(callback.id, `${state}`);
      return api.editMessage(chatId, messageId, draftMessage(draft), draftKeyboard(draft));
    }
    if (action === "save") {
      const result = await saveControlSession({
        user: actor(professor), groupId, fecha: date,
        payload: {
          estado: "dada", profesor_id: professor.id,
          asistencias: draft.students.map((student) => ({ alumno_id: student.id, estado: draft.states[student.id] })),
        },
      });
      drafts.delete(key);
      const counts = result.asistencias.reduce((acc, item) => ({ ...acc, [item.estado]: (acc[item.estado] || 0) + 1 }), {});
      await api.answerCallback(callback.id, "Asistencia guardada");
      return api.editMessage(chatId, messageId,
        `✅ Clase guardada como dada.\nPresentes: ${counts.presente || 0} · Faltas: ${counts.falta || 0} · Justificadas: ${counts.justificada || 0}`);
    }
    return api.answerCallback(callback.id, "Acción no reconocida");
  }

  async function handleUpdate(update) {
    if (update.message) return handleMessage(update.message);
    if (update.callback_query) return handleCallback(update.callback_query);
  }

  return { handleUpdate, handleMessage, handleCallback, drafts };
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

export { madridDate };
