import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

let linkedChatId = "100";
let pendingCodeHash = null;
let codeUsed = false;
let session = null;
const attendance = new Map();
const recoveries = new Map();
const groups = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  codigo: `G${index + 1}`,
  nombre: `Grupo ${index + 1}`,
  dia1: index < 2 ? "M" : "X",
  dia2: null,
  hora_inicio: `${String(9 + index).padStart(2, "0")}:00:00`,
  duracion_min: 60,
  pista_habitual: `Pista ${(index % 2) + 1}`,
  profesor_id: null,
}));
const students = [
  { id: 10, nombre: "Ana", apellidos: "A", asiste_dia1: 1, asiste_dia2: 0 },
  { id: 11, nombre: "Beto", apellidos: "B", asiste_dia1: 1, asiste_dia2: 0 },
];

async function query(sql, params = []) {
  if (sql.startsWith("UPDATE telegram_profesor_codigos SET usado_en = NOW() WHERE profesor_id")) return [{ affectedRows: 0 }];
  if (sql.startsWith("INSERT INTO telegram_profesor_codigos")) {
    pendingCodeHash = params[1];
    codeUsed = false;
    return [{ insertId: 1 }];
  }
  if (sql.includes("FROM telegram_profesor_codigos c")) {
    return [!codeUsed && params[0] === pendingCodeHash
      ? [{ codigo_id: 1, id: 1, usuario_id: 1, nombre: "Dani", apellidos: "Profesor" }] : []];
  }
  if (sql.startsWith("SELECT id FROM profesores WHERE telegram_chat_id = ? AND id <> ?")) return [[]];
  if (sql.startsWith("UPDATE profesores SET telegram_chat_id")) {
    linkedChatId = String(params[0]);
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("UPDATE telegram_profesor_codigos SET usado_en")) {
    codeUsed = true;
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM profesores") && sql.includes("telegram_chat_id = ?")) {
    return [String(params[0]) === linkedChatId
      ? [{ id: 1, usuario_id: 1, nombre: "Dani", apellidos: "Profesor", telegram_chat_id: linkedChatId }] : []];
  }
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql.includes("FROM grupos g") && sql.includes("g.curso_id = ?") && !sql.includes("g.id = ?")) return [groups];
  if (sql.includes("FROM grupos g") && sql.includes("g.id = ?")) {
    const group = groups.find((item) => Number(item.id) === Number(params[0]));
    return [group ? [{ ...group }] : []];
  }
  if (sql.includes("FROM grupo_alumnos ga")) return [students];
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) {
    return [session && Number(session.grupo_id) === Number(params[0]) && session.fecha === params[1] ? [{ ...session }] : []];
  }
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    session = {
      id: 40, grupo_id: Number(params[0]), profesor_id: Number(params[1]), fecha: params[2],
      hora_inicio: params[3], hora_fin: params[4], estado: params[5], observaciones: params[6],
    };
    return [{ insertId: 40 }];
  }
  if (sql.startsWith("UPDATE sesiones_clase")) {
    session.profesor_id = Number(params[0]);
    session.estado = params[1];
    session.observaciones = params[2];
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT id FROM asistencia_clase")) {
    return [attendance.has(Number(params[1])) ? [{ id: Number(params[1]) }] : []];
  }
  if (sql.startsWith("INSERT INTO asistencia_clase")) {
    attendance.set(Number(params[1]), params[2]);
    return [{ insertId: attendance.size }];
  }
  if (sql.startsWith("UPDATE asistencia_clase")) {
    attendance.set(Number(params[2]), params[0]);
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT alumno_id, estado FROM asistencia_clase")) {
    return [[...attendance].map(([alumno_id, estado]) => ({ alumno_id, estado }))];
  }
  if (sql.includes("FROM recuperaciones_clase r")) {
    return [[{
      id: 70, alumno_id: 11, grupo_id: 1, sesion_origen_id: 40,
      fecha_original: "2026-09-22", fecha_recuperacion: null,
      motivo: "falta_justificada", estado: "pendiente",
      alumno_nombre: "Beto", alumno_apellidos: "B", grupo_origen: "Grupo 1",
    }]];
  }
  if (sql.includes("FROM sesiones_clase s") && sql.includes("JOIN grupos g")) return [[]];
  if (sql.includes("FROM recuperaciones_clase") && sql.includes("sesion_origen_id = ?")) {
    return [recoveries.has(Number(params[0])) ? [{ id: params[0], estado: recoveries.get(Number(params[0])).estado }] : []];
  }
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) {
    recoveries.set(Number(params[0]), {
      alumno_id: Number(params[0]), grupo_id: Number(params[1]), fecha_original: params[2],
      motivo: "falta_justificada", estado: "pendiente", sesion_origen_id: Number(params[3]),
    });
    return [{ insertId: recoveries.size }];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__telegramTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({
      query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/backend/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__telegramTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { createTelegramLinkCode } = await import("../services/telegramLinkService.js");
const { createTelegramBot } = await import("../services/telegramBotService.js");

function fakeApi() {
  const calls = [];
  let nextMessageId = 1;
  return {
    calls,
    async sendMessage(chatId, text, reply_markup) {
      const result = { message_id: nextMessageId++, chatId, text, reply_markup };
      calls.push({ method: "sendMessage", ...result });
      return result;
    },
    async editMessage(chatId, messageId, text, reply_markup) {
      calls.push({ method: "editMessage", chatId, messageId, text, reply_markup });
      return true;
    },
    async answerCallback(id, text) {
      calls.push({ method: "answerCallback", id, text });
      return true;
    },
  };
}

test("vincula un profesor solo mediante código temporal de un solo uso", async () => {
  linkedChatId = "100";
  const code = await createTelegramLinkCode(1, globalThis.__telegramTestDb.promise());
  const api = fakeApi();
  const bot = createTelegramBot({ api, database: globalThis.__telegramTestDb, now: () => new Date("2026-09-22T10:00:00Z") });
  await bot.handleUpdate({ message: { chat: { id: 200, type: "private" }, from: { username: "dani" }, text: `/start ${code}` } });
  assert.equal(linkedChatId, "200");
  assert.match(api.calls.at(-1).text, /Telegram vinculado/);

  await bot.handleUpdate({ message: { chat: { id: 201, type: "private" }, text: `/start ${code}` } });
  assert.notEqual(linkedChatId, "201");
  assert.match(api.calls.at(-1).text, /no es válido/);
});

test("un chat no vinculado no recibe datos de alumnos", async () => {
  const api = fakeApi();
  const bot = createTelegramBot({ api, database: globalThis.__telegramTestDb });
  await bot.handleUpdate({ message: { chat: { id: 999, type: "private" }, text: "/hoy" } });
  assert.equal(api.calls.length, 1);
  assert.match(api.calls[0].text, /no vinculado/i);
  assert.doesNotMatch(api.calls[0].text, /Ana|Beto/);
});

test("/hoy muestra todas las clases del día con alumnos y botones", async () => {
  linkedChatId = "100";
  const api = fakeApi();
  const bot = createTelegramBot({ api, database: globalThis.__telegramTestDb, now: () => new Date("2026-09-22T10:00:00Z") });
  await bot.handleUpdate({ message: { chat: { id: 100, type: "private" }, text: "/hoy" } });
  assert.match(api.calls[0].text, /Clases de hoy.*2/);
  const classMessages = api.calls.filter((call) => call.reply_markup);
  assert.equal(classMessages.length, 2);
  assert.match(classMessages[0].text, /Ana.*Beto/);
  assert.ok(classMessages[0].reply_markup.inline_keyboard.flat().some((button) => button.text === "Pasar lista"));
});

test("/grupos muestra los nueve grupos activos y /recuperaciones las pendientes", async () => {
  linkedChatId = "100";
  const api = fakeApi();
  const bot = createTelegramBot({ api, database: globalThis.__telegramTestDb, now: () => new Date("2026-09-22T10:00:00Z") });
  await bot.handleUpdate({ message: { chat: { id: 100, type: "private" }, text: "/grupos" } });
  assert.match(api.calls[0].text, /Grupos activos: 9/);
  assert.equal(api.calls.filter((call) => call.reply_markup).length, 9);

  api.calls.length = 0;
  await bot.handleUpdate({ message: { chat: { id: 100, type: "private" }, text: "/recuperaciones" } });
  assert.match(api.calls[0].text, /Beto B.*Grupo 1.*pendiente/);
});

test("pasar lista guarda al profesor y genera recuperación por justificada", async () => {
  session = null;
  attendance.clear();
  recoveries.clear();
  linkedChatId = "100";
  const api = fakeApi();
  const bot = createTelegramBot({ api, database: globalThis.__telegramTestDb, now: () => new Date("2026-09-22T10:00:00Z") });
  await bot.handleUpdate({ callback_query: {
    id: "cb1", data: "attendance:1:2026-09-22", message: { message_id: 50, chat: { id: 100 } },
  } });
  await bot.handleUpdate({ callback_query: {
    id: "cb2", data: "mark:1:20260922:11:j", message: { message_id: 50, chat: { id: 100 } },
  } });
  await bot.handleUpdate({ callback_query: {
    id: "cb3", data: "save:1:20260922", message: { message_id: 50, chat: { id: 100 } },
  } });
  assert.equal(session.estado, "dada");
  assert.equal(session.profesor_id, 1);
  assert.equal(attendance.get(10), "presente");
  assert.equal(attendance.get(11), "justificada");
  assert.equal(recoveries.get(11).estado, "pendiente");
  assert.equal(recoveries.get(11).motivo, "falta_justificada");
  assert.match(api.calls.at(-1).text, /Justificadas: 1/);
});
