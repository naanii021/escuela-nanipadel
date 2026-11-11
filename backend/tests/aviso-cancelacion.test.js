import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Claves falsas: nada sale a Meta, fetch está simulado.
process.env.WHATSAPP_TOKEN = "token-de-prueba";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";

let session = null;
let recoveries = [];
let alumnosBd = [];
let conColumnaConsentimiento = false;
let tablasBandeja = true;
let escriturasBandeja = [];
let fetchCalls = [];
let fetchFalla = () => false;
let fetchPausaMs = 0;

const roster = () => alumnosBd.map(({ id, nombre }) => ({ id, nombre, apellidos: "Apellido" }));

async function query(sql, params = []) {
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql === "SHOW COLUMNS FROM profesores") return [[{ Field: "id" }, { Field: "usuario_id" }, { Field: "activo" }]];
  if (sql.startsWith("SELECT id FROM profesores WHERE (")) return [[{ id: 51 }]];
  if (sql.includes("FROM grupos g") && sql.includes("g.id = ?")) {
    return [[{ id: 8, nombre: "Adultos avanzado", profesor_id: 51, dia1: "J", dia2: null, hora_inicio: "19:30:00", duracion_min: 60 }]];
  }
  if (sql.includes("FROM grupo_alumnos ga")) return [roster()];
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) return [session && session.fecha === params[1] ? [{ ...session }] : []];
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    session = { id: 40, grupo_id: params[0], profesor_id: params[1], fecha: params[2], hora_inicio: params[3], hora_fin: params[4], estado: params[5], observaciones: params[6] };
    return [{ insertId: 40 }];
  }
  if (sql.startsWith("UPDATE sesiones_clase")) {
    Object.assign(session, { profesor_id: params[0], estado: params[1], observaciones: params[2] });
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM recuperaciones_clase") && sql.startsWith("SELECT")) return [[]];
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) { recoveries.push(params); return [{ insertId: 1 }]; }
  if (sql === "SHOW COLUMNS FROM alumnos LIKE 'acepta_whatsapp'") return [conColumnaConsentimiento ? [{ Field: "acepta_whatsapp" }] : []];
  if (sql.startsWith("SELECT id, nombre, telefono, tutor_telefono")) {
    const ids = params[0].map(Number);
    return [alumnosBd.filter((a) => ids.includes(a.id))];
  }
  if (sql.startsWith("SHOW TABLES LIKE")) return [tablasBandeja ? [{ t: 1 }] : []];
  if (sql.startsWith("INSERT INTO whatsapp_conversations")) { escriturasBandeja.push({ sql, params }); return [{ insertId: 7 }]; }
  if (sql.startsWith("SELECT id FROM whatsapp_conversations")) return [[{ id: 7 }]];
  if (sql.startsWith("INSERT INTO whatsapp_messages")) { escriturasBandeja.push({ sql, params }); return [{ insertId: 1 }]; }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__avisoTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__avisoTestDb;" };
    }
    return nextLoad(url, context);
  },
});

globalThis.fetch = async (url, options) => {
  const cuerpo = JSON.parse(options.body);
  fetchCalls.push({ url: String(url), cuerpo });
  if (fetchPausaMs) await new Promise((resolve) => setTimeout(resolve, fetchPausaMs));
  if (fetchFalla(cuerpo.to)) {
    return { ok: false, json: async () => ({ error: { message: "Número no registrado en WhatsApp" } }) };
  }
  return { ok: true, json: async () => ({ messages: [{ id: `wamid.${cuerpo.to}` }] }) };
};

const servicio = await import("../services/avisoCancelacionService.js");
const { default: router } = await import("../routes/gestionControl.js");
const { avisarCancelacion, calcularDestinatarios, estadoAvisos, leerConfigAvisos, enmascararTelefono } = servicio;

const ENV_ACTIVO = { WHATSAPP_AVISOS_CLASES: "true", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" };
const GRUPO = { id: 8, nombre: "Adultos avanzado", hora_inicio: "19:30:00" };

function alumnosDePrueba() {
  return [
    { id: 1, nombre: "Ana", telefono: "700000001", tutor_telefono: "600 111 222" },
    { id: 2, nombre: "Beto", telefono: "700000002", tutor_telefono: "+34600111222" },
    { id: 3, nombre: "Carla", telefono: "611 222 333", tutor_telefono: null },
    { id: 4, nombre: "Dani", telefono: "abc", tutor_telefono: "" },
    { id: 5, nombre: "Eva", telefono: null, tutor_telefono: null },
    { id: 6, nombre: "Fer", telefono: "", tutor_telefono: "0034622333444" },
  ];
}

function reset() {
  session = null;
  recoveries = [];
  alumnosBd = alumnosDePrueba();
  conColumnaConsentimiento = false;
  tablasBandeja = true;
  escriturasBandeja = [];
  fetchCalls = [];
  fetchFalla = () => false;
  fetchPausaMs = 0;
  for (const clave of ["WHATSAPP_AVISOS_CLASES", "WHATSAPP_AVISOS_MODO_PRUEBA", "WHATSAPP_AVISOS_SOLO_A"]) delete process.env[clave];
}

const q = (sql, params) => query(sql, params);
const lanzar = (extra = {}) => avisarCancelacion({
  query: q, grupo: GRUPO, fecha: "2026-11-05", alumnos: roster(), cancelacion: { motivo: "lluvia", texto: "" },
  recuperable: true, env: ENV_ACTIVO, pausaMs: 0, ...extra,
});

// Próximo jueves (el grupo de prueba juega los jueves), siempre en el futuro.
function proximoJueves() {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + 2);
  while (fecha.getUTCDay() !== 4) fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

async function llamar(method, path, body = {}, query = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } };
  await route.stack.at(-1).handle({ params: { grupoId: "8" }, query, body, user: { id: 99, rol: "profesor" } }, res);
  return res;
}
const cancelar = "/grupos/:grupoId/sesiones/cancelar";

test("destinatarios: sin duplicar, tutor antes que alumno y teléfonos inválidos descartados", async () => {
  reset();
  const calculo = await calcularDestinatarios({ query: q, alumnos: roster(), config: leerConfigAvisos(ENV_ACTIVO) });
  assert.deepEqual(calculo.familias.map((f) => [f.telefono, f.alumnos.map((a) => a.nombre)]), [
    ["+34600111222", ["Ana", "Beto"]], // tutor de dos hijos: un solo aviso
    ["+34611222333", ["Carla"]], // sin tutor: teléfono del alumno
    ["+34622333444", ["Fer"]], // 0034... normalizado
  ]);
  assert.deepEqual(calculo.sinTelefono.map((a) => [a.nombre, a.motivo]), [["Dani", "invalido"], ["Eva", "falta"]]);
});

test("con tutor, no se usa el teléfono del alumno aunque sea distinto", async () => {
  reset();
  const calculo = await calcularDestinatarios({ query: q, alumnos: roster(), config: leerConfigAvisos(ENV_ACTIVO) });
  assert.ok(!calculo.familias.some((f) => f.telefono === "+34700000001"));
});

test("interruptor apagado: no envía nada ni consulta teléfonos", async () => {
  reset();
  const llamadas = [];
  const resultado = await lanzar({ env: { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }, query: async (...a) => { llamadas.push(a); return q(...a); } });
  assert.equal(resultado.estado, "desactivado");
  assert.equal(resultado.mensaje, "Avisos por WhatsApp desactivados");
  assert.equal(fetchCalls.length, 0);
  assert.equal(llamadas.length, 0);
  const estado = await estadoAvisos({ query: q, alumnos: roster(), env: {} });
  assert.equal(estado.activo, false);
  assert.equal(estado.destinatarios, 0);
});

test("interruptor encendido pero sin claves de Meta: desactivado y sin envíos", async () => {
  reset();
  const resultado = await lanzar({ env: { WHATSAPP_AVISOS_CLASES: "true" } });
  assert.equal(resultado.estado, "desactivado");
  assert.equal(fetchCalls.length, 0);
  assert.equal(leerConfigAvisos({ WHATSAPP_AVISOS_CLASES: "true" }).motivoInactivo, "sin_claves_meta");
  assert.equal(leerConfigAvisos({ WHATSAPP_AVISOS_CLASES: "no", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }).activo, false);
});

test("envía una plantilla por familia con las variables acordadas", async () => {
  reset();
  const resultado = await lanzar();
  assert.equal(resultado.estado, "enviado");
  assert.deepEqual([resultado.enviados, resultado.fallidos, resultado.sinTelefono, resultado.omitidos], [3, 0, 2, 0]);
  assert.deepEqual(fetchCalls.map((c) => c.cuerpo.to), ["34600111222", "34611222333", "34622333444"]);
  const primera = fetchCalls[0].cuerpo.template;
  assert.equal(primera.name, "clase_cancelada");
  assert.deepEqual(primera.components[0].parameters.map((p) => p.text), [
    "Ana y Beto (grupo Adultos avanzado)",
    "jueves 5 de noviembre",
    "19:30",
    "por la lluvia. Se podrá recuperar y la escuela os dirá cuándo",
  ]);
  assert.deepEqual(resultado.nombresSinAvisar, ["Dani", "Eva"]);
  assert.match(resultado.mensaje, /Avisadas 3 familias/);
});

test("sin recuperación y con motivo libre cambian el texto del motivo", async () => {
  reset();
  await lanzar({ recuperable: false, cancelacion: { motivo: "otro", texto: "  Obras \n en la pista " } });
  assert.equal(fetchCalls[0].cuerpo.template.components[0].parameters[3].text, "Obras en la pista");
});

test("modo prueba: solo se envía a los números de WHATSAPP_AVISOS_SOLO_A", async () => {
  reset();
  const resultado = await lanzar({ env: { ...ENV_ACTIVO, WHATSAPP_AVISOS_SOLO_A: "611 222 333, +34999000111" } });
  assert.deepEqual(fetchCalls.map((c) => c.cuerpo.to), ["34611222333"]);
  assert.equal(resultado.enviados, 1);
  assert.equal(resultado.omitidos, 2);
  const estado = await estadoAvisos({ query: q, alumnos: roster(), env: { ...ENV_ACTIVO, WHATSAPP_AVISOS_SOLO_A: "611222333" } });
  assert.equal(estado.modo_prueba, true);
  assert.equal(estado.destinatarios, 1);
});

test("modo prueba activado con la lista vacía no envía a nadie", async () => {
  reset();
  const resultado = await lanzar({ env: { ...ENV_ACTIVO, WHATSAPP_AVISOS_MODO_PRUEBA: "true" } });
  assert.equal(resultado.estado, "sin_destinatarios");
  assert.equal(fetchCalls.length, 0);
});

test("fallo parcial: un error no corta los demás y se cuenta", async () => {
  reset();
  fetchFalla = (to) => to === "34611222333";
  const resultado = await lanzar();
  assert.equal(fetchCalls.length, 3);
  assert.equal(resultado.estado, "parcial");
  assert.deepEqual([resultado.enviados, resultado.fallidos], [2, 1]);
  assert.deepEqual(resultado.nombresSinAvisar, ["Dani", "Eva", "Carla"]);
  assert.match(resultado.mensaje, /no se pudo avisar a 1/);
});

test("todos fallan: estado error y nunca lanza", async () => {
  reset();
  fetchFalla = () => true;
  const resultado = await lanzar();
  assert.equal(resultado.estado, "error");
  assert.equal(resultado.fallidos, 3);
  const caida = await lanzar({ query: async () => { throw new Error("BD caída"); } });
  assert.equal(caida.estado, "error");
});

test("si la envoltura tarda demasiado devuelve en_curso y sigue en segundo plano", async () => {
  reset();
  fetchPausaMs = 40;
  const resultado = await lanzar({ esperaMaxMs: 10 });
  assert.equal(resultado.estado, "en_curso");
  assert.equal(resultado.total, 3);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(fetchCalls.length, 3);
});

test("consentimiento: con la columna acepta_whatsapp solo se avisa a quien tiene 1", async () => {
  reset();
  conColumnaConsentimiento = true;
  alumnosBd[0].acepta_whatsapp = 1; // Ana (tutor compartido con Beto)
  alumnosBd[1].acepta_whatsapp = 0; // Beto: dice que no
  alumnosBd[2].acepta_whatsapp = null; // Carla: sin respuesta
  alumnosBd[5].acepta_whatsapp = 0;
  const resultado = await lanzar();
  assert.deepEqual(fetchCalls.map((c) => c.cuerpo.to), ["34600111222"]);
  assert.equal(fetchCalls[0].cuerpo.template.components[0].parameters[0].text, "Ana (grupo Adultos avanzado)");
  assert.equal(resultado.omitidos, 2);
});

test("registro en la bandeja solo con las tablas existentes y sin nombres de alumnos", async () => {
  reset();
  await lanzar();
  const mensajes = escriturasBandeja.filter((e) => e.sql.startsWith("INSERT INTO whatsapp_messages"));
  assert.equal(mensajes.length, 3);
  assert.ok(!JSON.stringify(escriturasBandeja).includes("Ana"));
  reset();
  tablasBandeja = false;
  await lanzar();
  assert.equal(escriturasBandeja.length, 0);
});

test("enmascarar teléfono para los logs", () => {
  assert.equal(enmascararTelefono("+34622040926"), "+34••••••926");
  assert.ok(!enmascararTelefono("+34622040926").includes("2204"));
});

test("cancelar SIN avisar_familias no envía nada ni añade aviso", async () => {
  reset();
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  const res = await llamar("post", cancelar, { fecha: proximoJueves(), motivo: "lluvia", recuperable: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sesion.estado, "cancelada");
  assert.equal(res.body.aviso, undefined);
  assert.equal(res.body.aviso_interno, undefined);
  assert.equal(fetchCalls.length, 0);
});

test("cancelar con avisar_familias envía y devuelve el resultado en aviso", async () => {
  reset();
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  process.env.WHATSAPP_AVISOS_SOLO_A = "611222333,622333444";
  const res = await llamar("post", cancelar, { fecha: proximoJueves(), motivo: "lluvia", avisar_familias: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.aviso.estado, "enviado");
  assert.equal(res.body.aviso.enviados, 2);
  assert.equal(fetchCalls.length, 2);
});

test("cancelar con avisar_familias y avisos apagados: cancela y dice que están desactivados", async () => {
  reset();
  const res = await llamar("post", cancelar, { fecha: proximoJueves(), motivo: "pista", avisar_familias: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sesion.estado, "cancelada");
  assert.equal(res.body.aviso.estado, "desactivado");
  assert.equal(res.body.aviso.mensaje, "Avisos por WhatsApp desactivados");
  assert.equal(fetchCalls.length, 0);
});

test("la cancelación no falla aunque WhatsApp falle", async () => {
  reset();
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  process.env.WHATSAPP_AVISOS_SOLO_A = "611222333";
  fetchFalla = () => true;
  const res = await llamar("post", cancelar, { fecha: proximoJueves(), motivo: "lluvia", avisar_familias: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.sesion.estado, "cancelada");
  assert.equal(res.body.aviso.estado, "error");
  assert.equal(res.body.aviso.fallidos, 1);
});

test("no vuelve a avisar si la clase ya estaba cancelada ni si la fecha ya pasó", async () => {
  reset();
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  process.env.WHATSAPP_AVISOS_SOLO_A = "611222333";
  const fecha = proximoJueves();
  await llamar("post", cancelar, { fecha, motivo: "lluvia", avisar_familias: true });
  fetchCalls = [];
  const repetida = await llamar("post", cancelar, { fecha, motivo: "lluvia", avisar_familias: true });
  assert.equal(repetida.body.aviso.estado, "omitido");
  assert.equal(fetchCalls.length, 0);
  reset();
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  process.env.WHATSAPP_AVISOS_SOLO_A = "611222333";
  const pasada = await llamar("post", cancelar, { fecha: "2026-11-05", motivo: "lluvia", avisar_familias: true });
  assert.equal(pasada.statusCode, 200);
  assert.equal(pasada.body.aviso.estado, "omitido");
  assert.equal(fetchCalls.length, 0);
});

test("GET avisos-whatsapp: apagado sin consultar alumnos y activo con el nº de familias", async () => {
  reset();
  const fecha = proximoJueves();
  const apagado = await llamar("get", "/avisos-whatsapp", {}, { grupo_id: "8", fecha });
  assert.deepEqual([apagado.body.activo, apagado.body.destinatarios], [false, 0]);
  process.env.WHATSAPP_AVISOS_CLASES = "true";
  const activo = await llamar("get", "/avisos-whatsapp", {}, { grupo_id: "8", fecha });
  assert.deepEqual([activo.body.activo, activo.body.destinatarios, activo.body.sin_telefono, activo.body.modo_prueba], [true, 3, 2, false]);
  const malDia = await llamar("get", "/avisos-whatsapp", {}, { grupo_id: "8", fecha: "2026-11-06" });
  assert.equal(malDia.statusCode, 400);
  assert.equal(fetchCalls.length, 0);
});
