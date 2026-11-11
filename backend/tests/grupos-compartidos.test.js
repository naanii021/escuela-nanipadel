import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { consultaGp, gp, resetGp } from "./helpers/grupo-profesores.js";

// Clases compartidas: el grupo 8 lo imparten Dani (51, principal) y Juanjo (52); el 53 es un tercero.
const DANI = 51;
const JUANJO = 52;
const TERCERO = 53;
const FECHA = "2026-09-21"; // lunes: dia1 = L
const students = [
  { id: 1, nombre: "Ana", apellidos: "A", asiste_dia1: 1, asiste_dia2: 0 },
  { id: 2, nombre: "Beto", apellidos: "B", asiste_dia1: 1, asiste_dia2: 0 },
  { id: 3, nombre: "Cora", apellidos: "C", asiste_dia1: 1, asiste_dia2: 0 },
];

let session = null;
const attendance = new Map(); // alumno_id -> { estado, updated_at }
let clock = new Date("2026-09-21T16:00:00Z");
let writes = 0;
let rollbacks = 0;
let groupProfessorId = DANI;

function tick(minutes = 1) {
  clock = new Date(clock.getTime() + minutes * 60_000);
  return new Date(clock);
}

function esDelGrupo(profesorId) {
  if (groupProfessorId === profesorId) return true;
  return gp.tabla && gp.miembros.get(8)?.has(profesorId);
}

async function query(sql, params = []) {
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) {
    return [session && session.fecha === params[1] ? [{ ...session }] : []];
  }
  const gpRes = consultaGp(sql, params);
  if (gpRes) return gpRes;
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql.includes("FROM grupos g") && sql.includes("g.activo = 1")) {
    const group = { id: 8, nombre: "Niños competición", profesor_id: groupProfessorId, dia1: "L", dia2: "M", hora_inicio: "18:00:00", duracion_min: 60 };
    if (sql.includes("LEFT JOIN profesores p")) {
      const filtrado = params.length > 2;
      if (filtrado) {
        assert.equal(sql.includes("grupo_profesores"), gp.tabla, "el filtro usa grupo_profesores solo si la tabla existe");
        assert.equal(params[2], params[3] ?? params[2]);
      }
      return [!filtrado || esDelGrupo(params[2]) ? [group] : []];
    }
    return [[group]];
  }
  if (sql.includes("FROM grupo_alumnos ga")) return [students.filter((student) => student.asiste_dia1)];
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    writes += 1;
    session = {
      id: 11, grupo_id: params[0], profesor_id: params[1], fecha: params[2], hora_inicio: params[3],
      hora_fin: params[4], estado: params[5], observaciones: params[6], created_at: tick(), updated_at: new Date(clock),
    };
    return [{ insertId: 11 }];
  }
  if (sql.startsWith("UPDATE sesiones_clase")) {
    writes += 1;
    const antes = `${session.profesor_id}|${session.estado}|${session.observaciones}`;
    session.profesor_id = params[0];
    session.estado = params[1];
    session.observaciones = params[2];
    if (antes !== `${session.profesor_id}|${session.estado}|${session.observaciones}`) session.updated_at = tick();
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("SELECT id FROM asistencia_clase")) return [attendance.has(Number(params[1])) ? [{ id: Number(params[1]) }] : []];
  if (sql.startsWith("INSERT INTO asistencia_clase")) {
    writes += 1;
    attendance.set(Number(params[1]), { estado: params[2], updated_at: tick() });
    return [{ insertId: attendance.size }];
  }
  if (sql.startsWith("UPDATE asistencia_clase")) {
    writes += 1;
    attendance.set(Number(params[2]), { estado: params[0], updated_at: tick() });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT alumno_id, estado FROM asistencia_clase")) {
    return [[...attendance].map(([alumno_id, fila]) => ({ alumno_id, estado: fila.estado }))];
  }
  if (sql.includes("FROM recuperaciones_clase") && sql.includes("sesion_origen_id = ?")) return [[]];
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) return [{ insertId: 1 }];
  if (sql.startsWith("UPDATE recuperaciones_clase")) return [{ affectedRows: 0 }];
  if (sql.includes("FROM recuperaciones_clase r") || sql.includes("FROM sesiones_clase s")) {
    recoveryQueries.push({ sql, params });
    return [[]];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

const recoveryQueries = [];

globalThis.__controlTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => { rollbacks += 1; },
      release: () => {},
    }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__controlTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { default: router, listControlRecoveries } = await import("../routes/gestionControl.js");
const { resetGrupoProfesoresCache } = await import("../services/profesoresGrupo.js");

function preparar({ tabla }) {
  resetGp();
  resetGrupoProfesoresCache();
  gp.tabla = tabla;
  gp.nombres.set(DANI, { nombre: "Dani", apellidos: "Iglesias" });
  gp.nombres.set(JUANJO, { nombre: "Juanjo", apellidos: "Alonso" });
  gp.profesores.set(8, tabla
    ? [{ id: DANI, nombre: "Dani", apellidos: "Iglesias" }, { id: JUANJO, nombre: "Juanjo", apellidos: "Alonso" }]
    : [{ id: DANI, nombre: "Dani", apellidos: "Iglesias" }]);
  if (tabla) gp.miembros.set(8, new Set([DANI, JUANJO]));
  gp.agregado = () => {
    const conteos = new Map();
    for (const { estado, updated_at: en } of attendance.values()) {
      const previo = conteos.get(estado);
      conteos.set(estado, { estado, total: (previo?.total || 0) + 1, en: !previo || en > previo.en ? en : previo.en });
    }
    return [...conteos.values()];
  };
  session = null;
  attendance.clear();
  writes = 0;
  rollbacks = 0;
  groupProfessorId = DANI;
  clock = new Date("2026-09-21T16:00:00Z");
  recoveryQueries.length = 0;
}

const USUARIOS = {
  dani: { id: 1, rol: "profesor", profesor_id: DANI },
  juanjo: { id: 3, rol: "profesor", profesor_id: JUANJO },
  tercero: { id: 5, rol: "profe", profesor_id: TERCERO },
  admin: { id: 99, rol: "admin" },
};

async function call(method, path, quien, body = {}, query = { fecha: FECHA }) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await route.stack.at(-1).handle({
    params: { grupoId: "8", sesionId: "11" }, query, body: { fecha: FECHA, ...body }, user: USUARIOS[quien],
  }, res);
  return res;
}

const SESIONES = "/grupos/:grupoId/sesiones";
const LISTA = [{ alumno_id: 1, estado: "presente" }, { alumno_id: 2, estado: "presente" }, { alumno_id: 3, estado: "falta" }];

test("con tabla: Dani y Juanjo ven el grupo compartido con todos sus profesores; un tercero no", async () => {
  preparar({ tabla: true });
  for (const quien of ["dani", "juanjo", "admin"]) {
    const res = await call("get", "/grupos", quien);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.grupos.map((grupo) => grupo.id), [8], quien);
    const [grupo] = res.body.grupos;
    assert.deepEqual(grupo.profesores, [
      { id: DANI, nombre: "Dani", apellidos: "Iglesias" },
      { id: JUANJO, nombre: "Juanjo", apellidos: "Alonso" },
    ]);
    assert.deepEqual(grupo.profesores_ids, [DANI, JUANJO]);
    assert.equal(grupo.compartido, true);
    assert.equal(grupo.profesor_id, DANI);
    assert.equal(grupo.profesor, "Dani Iglesias y Juanjo Alonso");
  }
  const tercero = await call("get", "/grupos", "tercero");
  assert.deepEqual(tercero.body.grupos, []);
  const carga = await call("get", SESIONES, "tercero");
  assert.equal(carga.statusCode, 403);
  assert.match(carga.body.message, /no es tuyo/);
  const guarda = await call("post", SESIONES, "tercero", { estado: "dada", asistencias: LISTA });
  assert.equal(guarda.statusCode, 403);
  assert.equal(writes, 0);
});

test("con tabla: Juanjo (no principal) carga el grupo y puede pasar lista; la API devuelve el grupo", async () => {
  preparar({ tabla: true });
  const carga = await call("get", SESIONES, "juanjo");
  assert.equal(carga.statusCode, 200);
  assert.equal(carga.body.grupo.compartido, true);
  assert.deepEqual(carga.body.grupo.profesores_ids, [DANI, JUANJO]);
  assert.deepEqual(carga.body.sesiones, []);
  const guarda = await call("post", SESIONES, "juanjo", { estado: "dada", asistencias: LISTA });
  assert.equal(guarda.statusCode, 200, JSON.stringify(guarda.body));
  assert.equal(guarda.body.sesion.profesor_id, JUANJO);
  // y Dani también puede, sobre la misma sesión
  const dani = await call("put", `${SESIONES}/:sesionId/asistencia`, "dani", { asistencias: LISTA });
  assert.equal(dani.statusCode, 200);
  assert.equal(dani.body.sesion.profesor_id, DANI);
});

test("sin tabla: todo funciona con grupos.profesor_id; Juanjo no ve el grupo de Dani", async () => {
  preparar({ tabla: false });
  const dani = await call("get", "/grupos", "dani");
  assert.deepEqual(dani.body.grupos.map((grupo) => grupo.id), [8]);
  assert.equal(dani.body.grupos[0].compartido, false);
  assert.deepEqual(dani.body.grupos[0].profesores_ids, [DANI]);
  assert.equal(dani.body.grupos[0].profesor, "Dani Iglesias");
  const juanjo = await call("get", "/grupos", "juanjo");
  assert.deepEqual(juanjo.body.grupos, []);
  const carga = await call("get", SESIONES, "juanjo");
  assert.equal(carga.statusCode, 403);
  const guardaDani = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA });
  assert.equal(guardaDani.statusCode, 200);
  // aunque alguien mande base_cambio, sin tabla el grupo no es compartido: no hay 409
  const otra = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA, base_cambio: "2000-01-01T00:00:00Z" });
  assert.equal(otra.statusCode, 200);
});

test("con tabla pero profesor ausente de ella: sigue valiendo ser grupos.profesor_id (datos a medias)", async () => {
  preparar({ tabla: true });
  gp.miembros.set(8, new Set([JUANJO]));
  const res = await call("get", SESIONES, "dani");
  assert.equal(res.statusCode, 200);
});

test("ultimo_cambio: quién, cuándo, resumen y si hay asistencia", async () => {
  preparar({ tabla: true });
  const vacio = await call("get", SESIONES, "dani");
  assert.deepEqual(vacio.body.sesiones, []);

  const guarda = await call("post", SESIONES, "juanjo", { estado: "dada", asistencias: LISTA });
  const cambio = guarda.body.sesion.ultimo_cambio;
  assert.equal(cambio.profesor_id, JUANJO);
  assert.equal(cambio.profesor, "Juanjo Alonso");
  assert.equal(cambio.hay_asistencia, true);
  assert.equal(cambio.estado, "dada");
  assert.deepEqual(cambio.resumen, { presente: 2, falta: 1, justificada: 0 });
  assert.match(cambio.en, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  // `en` = el más reciente entre la sesión y las asistencias
  const masReciente = Math.max(session.updated_at.getTime(), ...[...attendance.values()].map((fila) => fila.updated_at.getTime()));
  assert.equal(new Date(cambio.en).getTime(), masReciente);

  const lectura = await call("get", SESIONES, "dani");
  assert.deepEqual(lectura.body.sesiones[0].ultimo_cambio, cambio);
});

test("ultimo_cambio sin asistencia ni profesor: hay_asistencia false y profesor null", async () => {
  preparar({ tabla: true });
  session = { id: 11, grupo_id: 8, profesor_id: null, fecha: FECHA, estado: "programada", observaciones: null, created_at: clock, updated_at: clock };
  const res = await call("get", SESIONES, "admin");
  const cambio = res.body.sesiones[0].ultimo_cambio;
  assert.equal(cambio.profesor_id, null);
  assert.equal(cambio.profesor, null);
  assert.equal(cambio.hay_asistencia, false);
  assert.deepEqual(cambio.resumen, { presente: 0, falta: 0, justificada: 0 });
});

test("409: guardar con un base_cambio anterior al cambio de otro profesor no escribe nada", async () => {
  preparar({ tabla: true });
  const primero = await call("post", SESIONES, "juanjo", { estado: "dada", asistencias: LISTA });
  const visto = primero.body.sesion.ultimo_cambio.en;
  const escrituras = writes;

  // Dani abrió la clase antes de que Juanjo guardase
  const conflicto = await call("put", `${SESIONES}/:sesionId/asistencia`, "dani", {
    asistencias: LISTA.map((item) => ({ ...item, estado: "falta" })), base_cambio: "2026-09-21T15:00:00.000Z",
  });
  assert.equal(conflicto.statusCode, 409);
  assert.equal(conflicto.body.ok, false);
  assert.equal(conflicto.body.conflicto, true);
  assert.match(conflicto.body.message, /^Juanjo ya guardó cambios en esta clase a las \d{2}:\d{2}\. Revísalos antes de guardar\.$/);
  assert.deepEqual(conflicto.body.ultimo_cambio, primero.body.sesion.ultimo_cambio);
  assert.equal(writes, escrituras, "no se ha escrito nada");
  assert.equal(rollbacks, 1);
  assert.equal(attendance.get(3).estado, "falta");
  assert.equal(attendance.get(1).estado, "presente");

  // con el `en` actual (ya lo vio) o sin base_cambio, guarda
  const ok = await call("put", `${SESIONES}/:sesionId/asistencia`, "dani", { asistencias: LISTA, base_cambio: visto });
  assert.equal(ok.statusCode, 200);
  const sinBase = await call("put", `${SESIONES}/:sesionId/asistencia`, "juanjo", { asistencias: LISTA });
  assert.equal(sinBase.statusCode, 200);
  const nulo = await call("put", `${SESIONES}/:sesionId/asistencia`, "dani", { asistencias: LISTA, base_cambio: null });
  assert.equal(nulo.statusCode, 200);
});

test("409: la hora del mensaje es la de Madrid y el admin también está sujeto si manda base_cambio", async () => {
  preparar({ tabla: true });
  session = { id: 11, grupo_id: 8, profesor_id: JUANJO, fecha: FECHA, estado: "dada", observaciones: null,
    created_at: new Date("2026-09-21T16:00:00Z"), updated_at: new Date("2026-09-21T16:40:00Z") };
  const admin = await call("post", SESIONES, "admin", { estado: "dada", asistencias: LISTA, base_cambio: "2026-09-21T16:10:00.000Z" });
  assert.equal(admin.statusCode, 409);
  assert.match(admin.body.message, /Juanjo ya guardó cambios en esta clase a las 18:40/);
  const adminSin = await call("post", SESIONES, "admin", { estado: "dada", asistencias: LISTA });
  assert.equal(adminSin.statusCode, 200);
});

test("409: no hay conflicto si el último cambio es del propio actor o el grupo no es compartido", async () => {
  preparar({ tabla: true });
  await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA });
  const propio = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA, base_cambio: "2000-01-01T00:00:00Z" });
  assert.equal(propio.statusCode, 200);

  preparar({ tabla: true });
  gp.profesores.set(8, [{ id: DANI, nombre: "Dani", apellidos: "Iglesias" }]); // un solo profesor
  session = { id: 11, grupo_id: 8, profesor_id: JUANJO, fecha: FECHA, estado: "dada", observaciones: null, created_at: clock, updated_at: tick(30) };
  const individual = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA, base_cambio: "2000-01-01T00:00:00Z" });
  assert.equal(individual.statusCode, 200);
});

test("409: base_cambio inválido es un 400; con 1970 se detecta un cambio hecho antes de abrir", async () => {
  preparar({ tabla: true });
  const mal = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA, base_cambio: "ayer" });
  assert.equal(mal.statusCode, 400);
  await call("post", SESIONES, "juanjo", { estado: "dada", asistencias: LISTA });
  const sinVer = await call("post", SESIONES, "dani", { estado: "dada", asistencias: LISTA, base_cambio: "1970-01-01T00:00:00.000Z" });
  assert.equal(sinVer.statusCode, 409);
});

test("cancelar y reabrir: devuelven ultimo_cambio y respetan base_cambio en grupos compartidos", async () => {
  preparar({ tabla: true });
  const guarda = await call("post", SESIONES, "juanjo", { estado: "dada", asistencias: LISTA });
  const visto = guarda.body.sesion.ultimo_cambio.en;

  const choque = await call("post", `${SESIONES}/cancelar`, "dani", { motivo: "lluvia", base_cambio: "2026-09-21T15:00:00Z" });
  assert.equal(choque.statusCode, 409);
  assert.equal(choque.body.conflicto, true);
  assert.equal(session.estado, "dada");

  const cancela = await call("post", `${SESIONES}/cancelar`, "dani", { motivo: "lluvia", base_cambio: visto });
  assert.equal(cancela.statusCode, 200, JSON.stringify(cancela.body));
  assert.equal(cancela.body.sesion.ultimo_cambio.profesor_id, DANI, "el último que guardó es quien cancela");
  assert.equal(cancela.body.sesion.ultimo_cambio.estado, "cancelada");

  const reabreChoque = await call("post", `${SESIONES}/reabrir`, "juanjo", { base_cambio: "2026-09-21T15:00:00Z" });
  assert.equal(reabreChoque.statusCode, 409);
  const reabre = await call("post", `${SESIONES}/reabrir`, "juanjo", { base_cambio: cancela.body.sesion.ultimo_cambio.en });
  assert.equal(reabre.statusCode, 200);
  assert.equal(reabre.body.sesion.ultimo_cambio.profesor_id, JUANJO);
  assert.equal(reabre.body.sesion.estado, "programada");
});

test("recuperaciones: con tabla las ven ambos profesores del grupo compartido", async () => {
  preparar({ tabla: true });
  for (const [id, esperado] of [[DANI, [DANI, DANI]], [JUANJO, [JUANJO, JUANJO]]]) {
    recoveryQueries.length = 0;
    await listControlRecoveries({ id: 1, rol: "profesor", profesor_id: id }, globalThis.__controlTestDb.promise());
    assert.equal(recoveryQueries.length, 2);
    for (const consulta of recoveryQueries) {
      assert.match(consulta.sql, /grupo_profesores/);
      assert.deepEqual(consulta.params, [26, 4, ...esperado]);
    }
  }
  preparar({ tabla: false });
  recoveryQueries.length = 0;
  await listControlRecoveries({ id: 1, rol: "profesor", profesor_id: DANI }, globalThis.__controlTestDb.promise());
  for (const consulta of recoveryQueries) {
    assert.doesNotMatch(consulta.sql, /grupo_profesores/);
    assert.deepEqual(consulta.params, [26, 4, DANI]);
  }
});
