import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

process.env.JWT_SECRET ||= "test-secret";
process.env.WHATSAPP_TOKEN = "test-token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123";

const students = [
  { id: 1, nombre: "Ana", apellidos: "Ruiz", telefono: "622 11 22 33", tutor_telefono: null },
  { id: 2, nombre: "Lucía", apellidos: "Gómez", telefono: null, tutor_telefono: "+34 655-44-33-22" },
  { id: 3, nombre: "Mario", apellidos: "Gómez", telefono: "600 00 00 01", tutor_telefono: "0034 655 44 33 22" },
  // Mismo teléfono que Ana pero dado de baja en el curso: nunca debe aparecer.
  { id: 4, nombre: "Pedro", apellidos: "Baja", telefono: "622112233", tutor_telefono: null, baja: true },
  // Mismos 9 últimos dígitos que Ana pero número extranjero: no es el mismo teléfono.
  { id: 5, nombre: "Zoe", apellidos: "Extranjera", telefono: "+44 622 11 22 33", tutor_telefono: null },
];
const groupsByStudent = {
  1: [{
    id: 1, codigo: "G1", nombre: "Iniciación Martes", nivel: "1", dia1: "M", dia2: "J",
    hora_inicio: "18:00:00", duracion_min: 60, pista_habitual: "Pista 2", asiste_dia1: 1, asiste_dia2: 0,
  }],
  2: [{
    id: 3, codigo: "G3", nombre: "Menores Viernes", nivel: null, dia1: "V", dia2: null,
    hora_inicio: "17:00:00", duracion_min: 60, pista_habitual: "Pista 1", asiste_dia1: 1, asiste_dia2: null,
  }],
  3: [{
    id: 2, codigo: "G2", nombre: "Perfeccionamiento", nivel: "3", dia1: "L", dia2: "X",
    hora_inicio: "19:30:00", duracion_min: 90, pista_habitual: "Pista 1", asiste_dia1: 1, asiste_dia2: 1,
  }],
};
const recoveriesByStudent = {
  1: [
    { id: 70, estado: "pendiente", fecha_original: "2026-09-22", fecha_recuperacion: null, grupo_nombre: "Iniciación Martes" },
    { id: 71, estado: "asignada", fecha_original: "2026-09-15", fecha_recuperacion: "2026-10-01", grupo_nombre: "Iniciación Martes" },
    { id: 72, estado: "recuperada", fecha_original: "2026-09-08", fecha_recuperacion: "2026-09-10", grupo_nombre: "Iniciación Martes" },
    { id: 73, estado: "cancelada", fecha_original: "2026-09-01", fecha_recuperacion: null, grupo_nombre: "Iniciación Martes" },
  ],
};
const selections = new Map();
const conversations = new Map();
const messages = [];
let assistantTableExists = true;

const cleanPhone = (value) => String(value || "").replace(/[\s\-.()]/g, "");

async function query(sql, params = []) {
  if (sql === "SHOW COLUMNS FROM alumnos") {
    return [["id", "nombre", "apellidos", "telefono", "tutor_telefono", "activo"].map((Field) => ({ Field }))];
  }
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql.includes("FROM alumnos a") && sql.includes("LIKE ?")) {
    assert.deepEqual(params.slice(0, 2), [26, 4]);
    assert.match(sql, /a\.activo = 1/);
    const suffixes = params.slice(2).map((like) => like.slice(1));
    return [students.filter((student) =>
      !(student.baja && sql.includes("<> 'baja'"))
      && [student.telefono, student.tutor_telefono].some((phone) =>
        phone && suffixes.some((suffix) => cleanPhone(phone).endsWith(suffix))))];
  }
  if (sql.startsWith("SELECT alumno_id, intencion_pendiente FROM whatsapp_conversacion_alumno")) {
    return [selections.has(params[0]) ? [{ ...selections.get(params[0]) }] : []];
  }
  if (sql.startsWith("INSERT INTO whatsapp_conversacion_alumno")) {
    selections.set(params[0], { alumno_id: params[1], intencion_pendiente: params[2] });
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM grupo_alumnos ga")) {
    assert.match(sql, /g\.curso_id = \? AND g\.sede_id = \?/);
    assert.match(sql, /ga\.activo = 1/);
    return [groupsByStudent[params[2]] || []];
  }
  if (sql.includes("FROM recuperaciones_clase r")) {
    assert.match(sql, /g\.curso_id = \? AND g\.sede_id = \?/);
    const rows = recoveriesByStudent[params[2]] || [];
    const onlyOpen = sql.includes("r.estado IN ('pendiente', 'asignada')");
    return [rows.filter((row) => !onlyOpen || row.estado === "pendiente" || row.estado === "asignada")];
  }
  // Consultas de la ruta del webhook.
  if (sql === "SHOW TABLES LIKE ?") {
    return [params[0] === "whatsapp_conversacion_alumno" && !assistantTableExists ? [] : [{ table: params[0] }]];
  }
  if (sql.startsWith("SELECT id FROM whatsapp_messages WHERE meta_message_id")) {
    return [messages.filter((item) => item.meta_message_id === params[0]).map((item) => ({ id: item.id }))];
  }
  if (sql.includes("INSERT INTO whatsapp_conversations")) {
    if (!conversations.has(params[0])) conversations.set(params[0], { id: conversations.size + 1, wa_id: params[0] });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT * FROM whatsapp_conversations WHERE wa_id")) {
    return [conversations.has(params[0]) ? [{ ...conversations.get(params[0]) }] : []];
  }
  if (sql.includes("INSERT INTO whatsapp_messages")) {
    const outbound = sql.includes("'outbound'");
    messages.push({
      id: messages.length + 1, conversation_id: params[0], meta_message_id: params[1],
      direccion: outbound ? "outbound" : "inbound", contenido: outbound ? params[2] : params[3],
    });
    return [{ insertId: messages.length }];
  }
  if (sql.startsWith("UPDATE whatsapp_conversations SET ultimo_mensaje")) return [{ affectedRows: 1 }];
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__whatsappTestDb = { promise: () => ({ query }) };

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/backend/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__whatsappTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { normalizePhoneNumber } = await import("../services/whatsappService.js");
const { createWhatsAppAssistant, detectIntent } = await import("../services/whatsappAssistantService.js");
const { default: router } = await import("../routes/whatsapp.js");

const ANA = "34622112233";
const FAMILIA_GOMEZ = "34655443322";

function newAssistant() {
  selections.clear();
  return createWhatsAppAssistant({ database: globalThis.__whatsappTestDb });
}

test("normaliza teléfonos españoles con +34, 0034, espacios y guiones", () => {
  for (const phone of ["622112233", "622 11 22 33", "622-11-22-33", "+34 622 11 22 33", "0034-622-112-233", "34622112233", "(+34) 622.11.22.33"]) {
    assert.equal(normalizePhoneNumber(phone), "+34622112233", phone);
  }
  assert.equal(normalizePhoneNumber("+44 622 11 22 33"), "+44622112233");
  assert.equal(normalizePhoneNumber("abc"), null);
});

test("detecta las intenciones mínimas escritas de forma natural", () => {
  assert.equal(detectIntent("Hola!"), "ayuda");
  assert.equal(detectIntent("ayuda por favor"), "ayuda");
  assert.equal(detectIntent("¿Cuándo tengo clase?"), "horario");
  assert.equal(detectIntent("me pasas el horario"), "horario");
  assert.equal(detectIntent("¿En qué grupo estoy?"), "grupo");
  assert.equal(detectIntent("¿Tengo recuperaciones?"), "recuperaciones");
  assert.equal(detectIntent("quiero recuperar una clase"), "recuperaciones");
  assert.equal(detectIntent("cambiar alumno"), "cambiar");
  assert.equal(detectIntent("qué tiempo hace"), null);
});

test("un alumno: se usa automáticamente, sin pedir selección ni mostrar alumnos ajenos", async () => {
  const assistant = newAssistant();
  const reply = await assistant.reply({ conversationId: 1, phone: ANA, text: "Hola" });
  assert.match(reply, /Ana Ruiz/);
  assert.match(reply, /¿Cuándo tengo clase\?/);
  assert.doesNotMatch(reply, /Pedro|Zoe|varios alumnos/);
  assert.equal(selections.size, 0);
});

test("hermanos con el mismo teléfono: pide elegir, guarda la selección y permite cambiar", async () => {
  const assistant = newAssistant();
  const prompt = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "¿Cuándo tengo clase?" });
  assert.match(prompt, /varios alumnos/);
  assert.match(prompt, /1\. Lucía Gómez\n2\. Mario Gómez/);
  assert.doesNotMatch(prompt, /Pista|Perfeccionamiento|Menores/);
  assert.deepEqual(selections.get(2), { alumno_id: null, intencion_pendiente: "horario" });

  const invalid = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "7" });
  assert.match(invalid, /varios alumnos/);
  assert.equal(selections.get(2).intencion_pendiente, "horario");

  // Al elegir se responde la pregunta que quedó pendiente.
  const chosen = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "2" });
  assert.match(chosen, /ahora consultamos a Mario Gómez/);
  assert.match(chosen, /Horario de Mario Gómez:\n• Perfeccionamiento: lunes y miércoles · 19:30–21:00 · Pista 1/);
  assert.deepEqual(selections.get(2), { alumno_id: 3, intencion_pendiente: null });

  const group = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "en qué grupo estoy" });
  assert.match(group, /Mario Gómez está en:\n• Perfeccionamiento \(nivel 3\)/);
  assert.match(group, /cambiar alumno/);

  const switched = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "cambiar alumno" });
  assert.match(switched, /varios alumnos/);
  assert.equal(selections.get(2).alumno_id, null);

  const byName = await assistant.reply({ conversationId: 2, phone: FAMILIA_GOMEZ, text: "lucia" });
  assert.match(byName, /ahora consultamos a Lucía Gómez/);
  assert.equal(selections.get(2).alumno_id, 2);
});

test("una selección guardada de un alumno que ya no está vinculado al teléfono no se usa", async () => {
  const assistant = newAssistant();
  // Conversación manipulada o dato antiguo: apunta a Ana, que no es de este teléfono.
  selections.set(3, { alumno_id: 1, intencion_pendiente: null });
  const reply = await assistant.reply({ conversationId: 3, phone: FAMILIA_GOMEZ, text: "horario" });
  assert.match(reply, /varios alumnos/);
  assert.doesNotMatch(reply, /Ana|Iniciación/);
  assert.equal(selections.get(3).alumno_id, null);
});

test("teléfono desconocido: no muestra datos y pide contactar con la escuela", async () => {
  const assistant = newAssistant();
  for (const text of ["Hola", "¿Cuándo tengo clase?", "¿Tengo recuperaciones?", "1"]) {
    const reply = await assistant.reply({ conversationId: 4, phone: "34611000000", text });
    assert.match(reply, /No encontramos ningún alumno/);
    assert.match(reply, /Contacta con la escuela/);
    assert.doesNotMatch(reply, /Ana|Lucía|Mario|Pista|Grupo|Iniciación/);
  }
  assert.equal(selections.size, 0);
});

test("horario: días que asiste, hora, pista y grupo del curso activo", async () => {
  const assistant = newAssistant();
  const reply = await assistant.reply({ conversationId: 1, phone: ANA, text: "¿cuándo tengo clase?" });
  // Grupo de martes y jueves, pero Ana solo asiste el martes.
  assert.equal(reply, "Horario de Ana Ruiz:\n• Iniciación Martes: martes · 18:00–19:00 · Pista 2");
});

test("grupo: devuelve el grupo del curso activo", async () => {
  const assistant = newAssistant();
  const reply = await assistant.reply({ conversationId: 1, phone: ANA, text: "¿En qué grupo estoy?" });
  assert.equal(reply, "Ana Ruiz está en:\n• Iniciación Martes (nivel 1)");
});

test("recuperaciones: solo pendientes y asignadas", async () => {
  const assistant = newAssistant();
  const reply = await assistant.reply({ conversationId: 1, phone: ANA, text: "tengo recuperaciones?" });
  assert.match(reply, /Clase del 22\/09\/2026 \(Iniciación Martes\) · pendiente/);
  assert.match(reply, /Clase del 15\/09\/2026 \(Iniciación Martes\) · asignada para el 01\/10\/2026/);
  assert.doesNotMatch(reply, /08\/09\/2026|01\/09\/2026|recuperada|cancelada/);

  const none = await newAssistant().reply({ conversationId: 5, phone: "34600000001", text: "recuperaciones" });
  assert.equal(none, "Mario Gómez no tiene recuperaciones pendientes ni asignadas.");
});

async function postWebhook(body) {
  const route = router.stack.find((layer) => layer.route?.path === "/webhook" && layer.route.methods.post).route;
  const res = { statusCode: null, sendStatus(code) { this.statusCode = code; return this; } };
  await route.stack.at(-1).handle({ body }, res);
  return res;
}

const inbound = (id, from, body) => ({
  entry: [{ changes: [{ value: { messages: [{ id, from, type: "text", timestamp: "1790000000", text: { body } }] } }] }],
});

test("webhook: responde solo si está activado, guarda la respuesta y no duplica reintentos de Meta", async () => {
  selections.clear();
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ messages: [{ id: `wamid.out${sent.length}` }] }) };
  };
  try {
    delete process.env.WHATSAPP_ASSISTANT_ENABLED;
    await postWebhook(inbound("wamid.in1", ANA, "horario"));
    assert.equal(sent.length, 0);
    assert.equal(messages.filter((item) => item.direccion === "inbound").length, 1);

    process.env.WHATSAPP_ASSISTANT_ENABLED = "true";
    const res = await postWebhook(inbound("wamid.in2", ANA, "horario"));
    assert.equal(res.statusCode, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, ANA);
    assert.match(sent[0].text.body, /Horario de Ana Ruiz/);
    const outbound = messages.filter((item) => item.direccion === "outbound");
    assert.equal(outbound.length, 1);
    assert.equal(outbound[0].meta_message_id, "wamid.out1");

    await postWebhook(inbound("wamid.in2", ANA, "horario"));
    assert.equal(sent.length, 1);
    assert.equal(messages.filter((item) => item.meta_message_id === "wamid.in2").length, 1);

    assistantTableExists = false;
    await postWebhook(inbound("wamid.in3", ANA, "horario"));
    assert.equal(sent.length, 1);
  } finally {
    assistantTableExists = true;
    delete process.env.WHATSAPP_ASSISTANT_ENABLED;
    globalThis.fetch = originalFetch;
  }
});
