import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const student = { id: 7, nombre: "Ana", apellidos: "Pérez", activo: 1 };
const enrollment = { alumno_id: 7, curso_id: 3, sede_id: 2, estado: "grupo_asignado", fecha_baja: null };
let groupAssignmentActive = 1;

const columns = {
  alumnos: ["id", "nombre", "apellidos", "nivel", "activo"],
  alumno_curso: ["alumno_id", "curso_id", "sede_id", "estado", "fecha_baja"],
  grupo_alumnos: ["grupo_id", "alumno_id", "activo"],
  usuarios: ["id"],
  pistas: ["id", "nombre"],
};

async function query(sql, params = []) {
  if (sql.startsWith("SHOW COLUMNS FROM ")) {
    const table = sql.slice("SHOW COLUMNS FROM ".length);
    return [columns[table].map((Field) => ({ Field }))];
  }
  if (sql.includes("FROM cursos_escolares c")) {
    return [[{ curso_id: 3, curso_nombre: "Curso", sede_id: 2, sede_nombre: "Seminario Diocesano" }]];
  }
  if (sql.includes("FROM alumnos WHERE id = ? LIMIT 1 FOR UPDATE")) return [[{ id: student.id }]];
  if (sql.includes("SELECT *") && sql.includes("FROM alumno_curso")) return [[{ ...enrollment }]];
  if (sql.includes("SELECT id, dia1, dia2") && sql.includes("FROM grupos")) {
    return [[{ id: 9, dia1: "lunes", dia2: null }]];
  }
  if (sql.includes("FROM grupo_alumnos WHERE grupo_id = ?")) {
    return [[{ grupo_id: 9, alumno_id: student.id, activo: groupAssignmentActive }]];
  }
  if (sql.startsWith("UPDATE alumno_curso SET ")) {
    assert.match(sql, /estado = \?/);
    enrollment.estado = params[0];
    if (sql.includes("fecha_baja = CURDATE()")) enrollment.fecha_baja = "2026-09-22";
    if (sql.includes("fecha_baja = NULL")) enrollment.fecha_baja = null;
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("UPDATE grupo_alumnos ga")) {
    groupAssignmentActive = 0;
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("UPDATE grupo_alumnos SET ")) {
    groupAssignmentActive = params[0];
    return [{ affectedRows: 1 }];
  }
  if (sql.includes("FROM alumnos a") && sql.includes("JOIN alumno_curso ac")) {
    assert.match(sql, /CASE WHEN ac\.estado = 'baja' THEN 0 ELSE 1 END AS matricula_activa/);
    assert.doesNotMatch(sql, /ac\.activo/);
    return [[{ ...student, matricula_activa: Number(enrollment.estado !== "baja"), grupo_ids: null }]];
  }
  if (sql.includes("FROM grupos g") && sql.includes("LEFT JOIN alumno_curso ac")) return [[]];
  if (sql.includes("FROM profesores") || sql.includes("FROM pistas")) return [[]];
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__gestionTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/backend/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__gestionTestDb;" };
    }
    if (url.endsWith("/backend/middleware/auth.js")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export const requireAuth = (_req, _res, next) => next(); export const requireRoles = () => requireAuth;",
      };
    }
    return nextLoad(url, context);
  },
});

const { default: router } = await import("../routes/gestion.js");

async function callRoute(method, path, body = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  const req = { params: { id: String(student.id) }, body, user: { id: 1, rol: "admin" } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return res.body;
}

test("la baja y reactivación se reflejan al recargar el resumen sin alumno_curso.activo", async () => {
  assert.equal((await callRoute("get", "/resumen")).alumnos[0].matricula_activa, 1);

  await callRoute("put", "/alumnos/:id", { matricula_activa: 0 });
  assert.equal(enrollment.estado, "baja");
  assert.equal(enrollment.fecha_baja, "2026-09-22");
  assert.equal(groupAssignmentActive, 0);
  assert.equal(student.activo, 1);
  const inactiveSummary = await callRoute("get", "/resumen");
  assert.equal(inactiveSummary.alumnos[0].matricula_activa, 0);
  assert.equal(inactiveSummary.catalogos.alumnos[0].matricula_activa, 0);

  await callRoute("put", "/alumnos/:id", { matricula_activa: 1 });
  assert.equal(enrollment.estado, "pendiente_grupo");
  assert.equal(enrollment.fecha_baja, null);
  const activeSummary = await callRoute("get", "/resumen");
  assert.equal(activeSummary.alumnos[0].matricula_activa, 1);
  assert.equal(activeSummary.catalogos.alumnos[0].matricula_activa, 1);

  await callRoute("put", "/alumnos/:id", { matricula_activa: 1, grupo_id: 9 });
  assert.equal(enrollment.estado, "grupo_asignado");
  assert.equal(groupAssignmentActive, 1);
});
