import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

let session = null;
let nextSessionId = 40;
let nextRecoveryId = 1;
let recoveries = [];
let attendance = new Map();
let rollbacks = 0;
const students = [
  { id: 1, nombre: "Ana", apellidos: "A" },
  { id: 2, nombre: "Beto", apellidos: "B" },
];

async function query(sql, params = []) {
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql === "SHOW COLUMNS FROM profesores") return [[{ Field: "id" }, { Field: "usuario_id" }, { Field: "activo" }]];
  if (sql.startsWith("SELECT id FROM profesores WHERE (")) return [[{ id: 51 }]];
  if (sql.includes("FROM grupos g") && sql.includes("g.id = ?")) {
    return [[{ id: 8, nombre: "Adultos avanzado", profesor_id: 51, dia1: "J", dia2: null, hora_inicio: "19:30:00", duracion_min: 60 }]];
  }
  if (sql.includes("FROM grupo_alumnos ga")) return [students];
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) return [session && session.fecha === params[1] ? [{ ...session }] : []];
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    session = {
      id: nextSessionId, grupo_id: params[0], profesor_id: params[1], fecha: params[2],
      hora_inicio: params[3], hora_fin: params[4], estado: params[5], observaciones: params[6],
    };
    return [{ insertId: nextSessionId }];
  }
  if (sql.startsWith("UPDATE sesiones_clase")) {
    Object.assign(session, { profesor_id: params[0], estado: params[1], observaciones: params[2] });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT alumno_id, estado FROM asistencia_clase")) {
    return [[...attendance].map(([alumno_id, estado]) => ({ alumno_id, estado }))];
  }
  if (sql.startsWith("SELECT id FROM asistencia_clase")) return [attendance.has(Number(params[1])) ? [{ id: 1 }] : []];
  if (sql.startsWith("INSERT INTO asistencia_clase")) { attendance.set(Number(params[1]), params[2]); return [{ insertId: 1 }]; }
  if (sql.startsWith("UPDATE asistencia_clase")) { attendance.set(Number(params[2]), params[0]); return [{ affectedRows: 1 }]; }
  if (sql.includes("FROM recuperaciones_clase") && sql.includes("sesion_origen_id = ?") && sql.startsWith("SELECT")) {
    const found = recoveries.find((item) => item.alumno_id === Number(params[0]) && item.sesion_origen_id === Number(params[1]));
    return [found ? [{ id: found.id, estado: found.estado, motivo: found.motivo }] : []];
  }
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) {
    const motivo = /'(clase_cancelada|falta_justificada)'/.exec(sql)[1];
    recoveries.push({
      id: nextRecoveryId++, alumno_id: Number(params[0]), grupo_id: Number(params[1]), fecha_original: params[2],
      motivo, estado: "pendiente", sesion_origen_id: Number(params[3]),
    });
    return [{ insertId: recoveries.length }];
  }
  if (sql.includes("UPDATE recuperaciones_clase") && sql.includes("SET estado = 'pendiente'")) {
    Object.assign(recoveries.find((item) => item.id === params[0]), { estado: "pendiente", motivo: "clase_cancelada" });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("UPDATE recuperaciones_clase SET estado = 'cancelada'")) {
    if (sql.includes("sesion_origen_id = ?")) {
      const afectadas = recoveries.filter((item) => item.sesion_origen_id === params[0]
        && item.motivo === "clase_cancelada" && item.estado === "pendiente");
      afectadas.forEach((item) => { item.estado = "cancelada"; });
      return [{ affectedRows: afectadas.length }];
    }
    recoveries.find((item) => item.id === params[0]).estado = "cancelada";
    return [{ affectedRows: 1 }];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__cancelTestDb = {
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
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__cancelTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { default: router, formatCancelacion, parseCancelacion } = await import("../routes/gestionControl.js");

// 2026-11-05 es jueves.
async function call(method, path, body = {}, role = "profesor") {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await route.stack.at(-1).handle({
    params: { grupoId: "8", sesionId: String(session?.id ?? 40) },
    query: { fecha: body.fecha || "2026-11-05" }, body: { fecha: "2026-11-05", ...body }, user: { id: 99, rol: role },
  }, res);
  return res;
}

const cancelar = "/grupos/:grupoId/sesiones/cancelar";
const reabrir = "/grupos/:grupoId/sesiones/reabrir";

function reset() {
  session = null;
  recoveries = [];
  attendance = new Map();
  rollbacks = 0;
}

test("formato del motivo: CANCELADA|motivo|texto, con lectura tolerante", () => {
  assert.equal(formatCancelacion("lluvia"), "CANCELADA|lluvia|");
  assert.equal(formatCancelacion("otro", "  Obras \n en la pista "), "CANCELADA|otro|Obras en la pista");
  assert.deepEqual(parseCancelacion("CANCELADA|lluvia|"), { motivo: "lluvia", texto: "", etiqueta: "Lluvia" });
  assert.equal(parseCancelacion("CANCELADA|otro|Obras | y más").texto, "Obras | y más");
  assert.equal(parseCancelacion("CANCELADA|inventado|x").motivo, "otro");
  assert.equal(parseCancelacion("Clase normal"), null);
  assert.equal(parseCancelacion(null), null);
});

test("cancelar con recuperaciones: crea la sesión y una pendiente por alumno", async () => {
  reset();
  const res = await call("post", cancelar, { motivo: "lluvia", recuperable: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sesion.estado, "cancelada");
  assert.equal(session.observaciones, "CANCELADA|lluvia|");
  assert.deepEqual(res.body.sesion.cancelacion, { motivo: "lluvia", texto: "", etiqueta: "Lluvia" });
  assert.equal(res.body.recuperaciones_creadas, 2);
  assert.deepEqual(recoveries.map((item) => [item.alumno_id, item.motivo, item.estado, item.sesion_origen_id]),
    [[1, "clase_cancelada", "pendiente", 40], [2, "clase_cancelada", "pendiente", 40]]);
});

test("cancelar de nuevo no duplica recuperaciones y 'otro' guarda el texto", async () => {
  const res = await call("post", cancelar, { motivo: "otro", texto: "Obras en la pista" });
  assert.equal(res.statusCode, 200);
  assert.equal(session.observaciones, "CANCELADA|otro|Obras en la pista");
  assert.equal(recoveries.length, 2);
  assert.equal(res.body.recuperaciones_creadas, 0);
});

test("cancelar sin la casilla no crea recuperaciones", async () => {
  reset();
  const res = await call("post", cancelar, { motivo: "pista", recuperable: false }, "admin");
  assert.equal(res.statusCode, 200);
  assert.equal(recoveries.length, 0);
  assert.equal(session.estado, "cancelada");
});

test("desmarcar la casilla al recancelar retira solo las pendientes de la cancelación", async () => {
  reset();
  await call("post", cancelar, { motivo: "lluvia" });
  recoveries[0].estado = "asignada";
  const res = await call("post", cancelar, { motivo: "lluvia", recuperable: false });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(recoveries.map((item) => item.estado), ["asignada", "cancelada"]);
});

test("una sesión cancelada rechaza asistencias y cambios de estado con un 400 claro", async () => {
  reset();
  await call("post", cancelar, { motivo: "lluvia" });
  const asistencias = [{ alumno_id: 1, estado: "presente" }, { alumno_id: 2, estado: "falta" }];
  const put = await call("put", "/grupos/:grupoId/sesiones/:sesionId/asistencia", { estado: "dada", asistencias });
  assert.equal(put.statusCode, 400);
  assert.match(put.body.message, /cancelada/);
  const post = await call("post", "/grupos/:grupoId/sesiones", { asistencias });
  assert.equal(post.statusCode, 400);
  assert.equal(attendance.size, 0);
  assert.equal(session.estado, "cancelada");
  assert.ok(rollbacks >= 2);
});

test("cancelar por la ruta genérica no vale y hace falta un motivo válido y un día con clase", async () => {
  reset();
  const generic = await call("post", "/grupos/:grupoId/sesiones", { estado: "cancelada" });
  assert.equal(generic.statusCode, 400);
  assert.equal((await call("post", cancelar, {})).statusCode, 400);
  assert.equal((await call("post", cancelar, { motivo: "aburrimiento" })).statusCode, 400);
  assert.equal(session, null);
  assert.equal((await call("post", cancelar, { motivo: "lluvia", fecha: "2026-11-06" })).statusCode, 400);
  assert.equal((await call("post", cancelar, { motivo: "lluvia", fecha: "no" })).statusCode, 400);
});

test("reabrir vuelve a programada, retira las pendientes y respeta asignadas y recuperadas", async () => {
  reset();
  await call("post", cancelar, { motivo: "lluvia" });
  recoveries.push({ id: 50, alumno_id: 3, motivo: "clase_cancelada", estado: "recuperada", sesion_origen_id: 40 });
  recoveries.push({ id: 51, alumno_id: 4, motivo: "falta_justificada", estado: "pendiente", sesion_origen_id: 40 });
  recoveries[0].estado = "asignada";
  const res = await call("post", reabrir);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sesion.estado, "programada");
  assert.equal(session.observaciones, null);
  assert.equal(res.body.recuperaciones_retiradas, 1);
  assert.deepEqual(recoveries.map((item) => item.estado), ["asignada", "cancelada", "recuperada", "pendiente"]);

  // Ya se puede pasar lista.
  const lista = await call("post", "/grupos/:grupoId/sesiones", {
    estado: "dada", asistencias: [{ alumno_id: 1, estado: "presente" }, { alumno_id: 2, estado: "presente" }],
  });
  assert.equal(lista.statusCode, 200);
  assert.equal((await call("post", reabrir)).statusCode, 409);
});

test("syncRecoveries no cancela por error las recuperaciones de una cancelación", async () => {
  reset();
  await call("post", cancelar, { motivo: "lluvia" });
  // Aunque la sesión se hubiera reabierto a mano, la asistencia no toca una recuperación clase_cancelada.
  session.estado = "programada";
  await call("put", "/grupos/:grupoId/sesiones/:sesionId/asistencia", {
    estado: "dada", asistencias: [{ alumno_id: 1, estado: "presente" }, { alumno_id: 2, estado: "presente" }],
  });
  assert.deepEqual(recoveries.map((item) => item.estado), ["pendiente", "pendiente"]);
});

test("permisos: un alumno no cancela ni reabre; un profesor y un admin sí", async () => {
  reset();
  assert.equal((await call("post", cancelar, { motivo: "lluvia" }, "alumno")).statusCode, 403);
  assert.equal((await call("post", reabrir, {}, "alumno")).statusCode, 403);
  assert.equal(session, null);
  assert.equal((await call("post", cancelar, { motivo: "lluvia" }, "profe")).statusCode, 200);
  assert.equal((await call("post", reabrir, {}, "admin")).statusCode, 200);
});
