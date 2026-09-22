import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

let session = null;
let attendance = null;
let recovery = null;
let recoveryInserts = 0;
let commits = 0;
let rollbacks = 0;

async function query(sql, params = []) {
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql === "SHOW COLUMNS FROM profesores") {
    return [[{ Field: "id" }, { Field: "usuario_id" }, { Field: "activo" }]];
  }
  if (sql.startsWith("SELECT id FROM profesores WHERE (")) {
    assert.match(sql, /activo = 1/);
    return [[{ id: 51 }]];
  }
  if (sql.includes("FROM grupos g") && sql.includes("g.id = ?") && sql.includes("g.activo = 1")) {
    return [[{ id: 8, nombre: "Grupo", profesor_id: null, dia1: "M", dia2: null, hora_inicio: "18:00:00", duracion_min: 60 }]];
  }
  if (sql.includes("FROM grupo_alumnos ga")) return [[{ id: 2, nombre: "Beto", apellidos: "B" }]];
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) {
    return [session && params[1] === session.fecha ? [{ ...session }] : []];
  }
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    session = {
      id: 11, grupo_id: 8, profesor_id: params[1], fecha: params[2],
      hora_inicio: params[3], hora_fin: params[4], estado: params[5], observaciones: params[6],
    };
    return [{ insertId: 11 }];
  }
  if (sql.startsWith("UPDATE sesiones_clase")) {
    session.profesor_id = params[0];
    session.estado = params[1];
    session.observaciones = params[2];
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT id FROM asistencia_clase")) return [attendance ? [{ id: 1 }] : []];
  if (sql.startsWith("INSERT INTO asistencia_clase")) {
    attendance = { alumno_id: Number(params[1]), estado: params[2] };
    return [{ insertId: 1 }];
  }
  if (sql.startsWith("UPDATE asistencia_clase")) {
    attendance.estado = params[0];
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT alumno_id, estado FROM asistencia_clase")) return [attendance ? [{ ...attendance }] : []];
  if (sql.includes("FROM recuperaciones_clase") && sql.includes("sesion_origen_id = ?")) {
    return [recovery ? [{ id: recovery.id, estado: recovery.estado }] : []];
  }
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) {
    recoveryInserts += 1;
    recovery = {
      id: 1, alumno_id: Number(params[0]), grupo_id: Number(params[1]),
      fecha_original: params[2], motivo: "falta_justificada", estado: "pendiente",
      sesion_origen_id: Number(params[3]), sesion_recuperacion_id: null,
      fecha_recuperacion: null, observaciones: null,
    };
    return [{ insertId: 1 }];
  }
  if (sql.includes("SET estado = 'pendiente'")) {
    recovery.estado = "pendiente";
    recovery.fecha_recuperacion = null;
    recovery.sesion_recuperacion_id = null;
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("SET estado = 'cancelada'")) {
    recovery.estado = "cancelada";
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM recuperaciones_clase r") && sql.includes("WHERE r.id = ?")) {
    return [recovery ? [{ ...recovery }] : []];
  }
  if (sql.startsWith("UPDATE recuperaciones_clase")) {
    recovery.estado = params[0];
    recovery.fecha_recuperacion = params[1];
    recovery.sesion_recuperacion_id = params[2];
    recovery.observaciones = params[3];
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM recuperaciones_clase r")) {
    assert.match(sql, /g\.curso_id = \? AND g\.sede_id = \?/);
    return [recovery ? [{ ...recovery, alumno_nombre: "Beto", alumno_apellidos: "B", grupo_origen: "Grupo" }] : []];
  }
  if (sql.includes("FROM sesiones_clase s") && sql.includes("WHERE s.id = ?")) {
    return [Number(params[2]) === 12 ? [{ id: 12, fecha: "2026-09-29" }] : []];
  }
  if (sql.includes("FROM sesiones_clase s")) {
    return [[{ id: 12, grupo_id: 8, fecha: "2026-09-29", grupo_nombre: "Grupo" }]];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__recoveryTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({
      query, beginTransaction: async () => {},
      commit: async () => { commits += 1; },
      rollback: async () => { rollbacks += 1; },
      release: () => {},
    }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/backend/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__recoveryTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { default: router } = await import("../routes/gestionControl.js");

async function call(method, path, body = {}, role = "profesor") {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({
    params: { grupoId: "8", sesionId: "11", id: "1" },
    query: {}, body: { fecha: "2026-09-22", ...body }, user: { id: 99, rol: role },
  }, res);
  return res;
}

const sessionsPath = "/grupos/:grupoId/sesiones";
const attendancePath = `${sessionsPath}/:sesionId/asistencia`;
const recoveryPath = "/recuperaciones/:id";

test("justificada en clase dada crea una única recuperación; cambios cancelan sin borrar historial", async () => {
  const created = await call("post", sessionsPath, {
    estado: "programada", asistencias: [{ alumno_id: 2, estado: "justificada" }],
  });
  assert.equal(created.statusCode, 200);
  assert.equal(recovery, null);

  assert.equal((await call("put", attendancePath, { estado: "dada" })).statusCode, 200);
  assert.equal(recovery.estado, "pendiente");
  assert.equal(recovery.motivo, "falta_justificada");
  assert.equal(recovery.sesion_origen_id, 11);
  assert.equal(recoveryInserts, 1);

  await call("put", attendancePath, { estado: "dada" });
  assert.equal(recoveryInserts, 1);

  await call("put", attendancePath, { estado: "programada" });
  assert.equal(recovery.estado, "cancelada");
  await call("put", attendancePath, { estado: "dada" });
  assert.equal(recovery.estado, "pendiente");

  await call("put", attendancePath, { asistencias: [{ alumno_id: 2, estado: "presente" }] });
  assert.equal(recovery.estado, "cancelada");
  await call("put", attendancePath, { asistencias: [{ alumno_id: 2, estado: "justificada" }] });
  assert.equal(recovery.estado, "pendiente");
  assert.equal(recoveryInserts, 1);

  const listed = await call("get", "/recuperaciones");
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.recuperaciones[0].grupo_origen, "Grupo");
  assert.equal(listed.body.sesiones[0].id, 12);

  const assigned = await call("patch", recoveryPath, {
    estado: "asignada", fecha_recuperacion: "2026-09-29", sesion_recuperacion_id: 12,
  });
  assert.equal(assigned.statusCode, 200);
  assert.equal(recovery.sesion_recuperacion_id, 12);

  await call("put", attendancePath, { asistencias: [{ alumno_id: 2, estado: "falta" }] });
  assert.equal(recovery.estado, "cancelada");
  await call("put", attendancePath, { asistencias: [{ alumno_id: 2, estado: "justificada" }] });
  assert.equal(recovery.estado, "pendiente");
  assert.equal(recovery.sesion_recuperacion_id, null);
  assert.equal(recovery.fecha_recuperacion, null);

  assert.equal((await call("patch", recoveryPath, {
    estado: "recuperada", fecha_recuperacion: "2026-09-29", sesion_recuperacion_id: 12,
  })).statusCode, 200);
  await call("put", attendancePath, { asistencias: [{ alumno_id: 2, estado: "falta" }] });
  assert.equal(recovery.estado, "recuperada");
  assert.equal(recoveryInserts, 1);
  assert.ok(commits >= 11);
});

test("valida la sesión de destino y los permisos del curso", async () => {
  const invalidTarget = await call("patch", recoveryPath, {
    estado: "asignada", fecha_recuperacion: "2026-09-29", sesion_recuperacion_id: 99,
  });
  assert.equal(invalidTarget.statusCode, 400);
  assert.equal(recovery.estado, "recuperada");
  assert.equal(rollbacks, 1);

  assert.equal((await call("get", "/recuperaciones", {}, "alumno")).statusCode, 403);
  assert.equal((await call("patch", recoveryPath, { estado: "pendiente" }, "alumno")).statusCode, 403);
});
