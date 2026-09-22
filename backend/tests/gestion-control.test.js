import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

let session = null;
const attendance = new Map();
let commits = 0;
let rollbacks = 0;
let inserts = 0;
let professorActive = true;
let professorLinked = true;
const students = [
  { id: 1, nombre: "Ana", apellidos: "A", asiste_dia1: 1, asiste_dia2: 0 },
  { id: 2, nombre: "Beto", apellidos: "B", asiste_dia1: 0, asiste_dia2: 1 },
  { id: 3, nombre: "Cora", apellidos: "C", asiste_dia1: 1, asiste_dia2: 1 },
];

async function query(sql, params = []) {
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 26, sede_id: 4 }]];
  if (sql.includes("FROM grupos g") && sql.includes("g.activo = 1")) {
    if (sql.includes("LEFT JOIN profesores p")) {
      assert.deepEqual(params, [26, 4]);
      return [[{ id: 8, nombre: "Grupo", profesor_id: null, dia1: "L", dia2: "M" }]];
    }
    assert.deepEqual(params, ["8", 26, 4]);
    return [[{ id: 8, nombre: "Grupo", profesor_id: null, dia1: "L", dia2: "M", hora_inicio: "18:00:00", duracion_min: 60 }]];
  }
  if (sql.includes("FROM grupo_alumnos ga")) {
    assert.match(sql, /COALESCE\(ac\.estado, ''\) <> 'baja'/);
    assert.match(sql, /COALESCE\(ga\.asiste_dia1, 1\)/);
    assert.match(sql, /COALESCE\(ga\.asiste_dia2, 1\)/);
    const day = params[3];
    return [students.filter((student) =>
      (day === "L" && student.asiste_dia1) || (day === "M" && student.asiste_dia2))];
  }
  if (sql.includes("FROM sesiones_clase WHERE grupo_id")) {
    return [session && session.fecha === params[1] ? [{ ...session }] : []];
  }
  if (sql.includes("FROM asistencia_clase WHERE sesion_id = ?") && !sql.includes("alumno_id = ?")) {
    return [[...attendance].map(([alumno_id, estado]) => ({ alumno_id, estado }))];
  }
  if (sql === "SHOW COLUMNS FROM profesores") {
    return [[{ Field: "id" }, { Field: "usuario_id" }, { Field: "activo" }]];
  }
  if (sql === "SELECT id FROM profesores WHERE id = ? LIMIT 1") return [[{ id: params[0] }]];
  if (sql.startsWith("SELECT id FROM profesores WHERE ")) {
    assert.match(sql, /usuario_id = \?/);
    assert.match(sql, /activo = 1/);
    assert.doesNotMatch(sql, /profesor_id/);
    return [professorActive && professorLinked && Number(params[0]) === 99 ? [{ id: 51 }] : []];
  }
  if (sql.startsWith("INSERT INTO sesiones_clase")) {
    inserts += 1;
    session = {
      id: 11, grupo_id: params[0], profesor_id: params[1], fecha: params[2],
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
  if (sql.includes("SELECT id FROM asistencia_clase")) {
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
  if (sql.includes("FROM recuperaciones_clase") && sql.includes("sesion_origen_id = ?")) return [[]];
  if (sql.startsWith("INSERT INTO recuperaciones_clase")) return [{ insertId: 1 }];
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__controlTestDb = {
  promise: () => ({
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => { commits += 1; },
      rollback: async () => { rollbacks += 1; },
      release: () => {},
    }),
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/backend/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__controlTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { default: router } = await import("../routes/gestionControl.js");

async function call(method, path, { fecha = "2026-09-22", ...body } = {}, role = "admin") {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({
    params: { grupoId: "8", sesionId: "11" },
    query: { fecha }, body: { fecha, ...body }, user: { id: 99, rol: role },
  }, res);
  return res;
}

const path = "/grupos/:grupoId/sesiones";

test("sesión y asistencia del martes: guardar, reabrir y actualizar sin duplicados", async () => {
  const groups = await call("get", "/grupos");
  assert.deepEqual(groups.body.grupos.map((group) => group.id), [8]);
  const before = await call("get", path);
  assert.deepEqual(before.body.alumnos.map((item) => item.id), [2, 3]);
  assert.deepEqual(before.body.sesiones, []);

  const first = await call("post", path, {
    profesor_id: 77, estado: "dada", observaciones: "Clase normal",
    asistencias: [{ alumno_id: 2, estado: "presente" }, { alumno_id: 3, estado: "falta" }],
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.sesion.estado, "dada");
  assert.equal(first.body.sesion.profesor_id, 77);
  assert.equal(first.body.sesion.hora_fin, "19:00:00");
  assert.equal(commits, 1);

  const reopened = await call("get", path);
  assert.equal(reopened.body.sesiones[0].id, 11);
  assert.deepEqual(reopened.body.asistencias, [
    { alumno_id: 2, estado: "presente" }, { alumno_id: 3, estado: "falta" },
  ]);

  const again = await call("post", path);
  assert.equal(again.body.sesion.id, 11);
  assert.equal(inserts, 1);

  const edited = await call("put", `${path}/:sesionId/asistencia`, {
    profesor_id: null, estado: "dada",
    asistencias: [{ alumno_id: 2, estado: "justificada" }, { alumno_id: 3, estado: "presente" }],
  });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.body.sesion.profesor_id, null);
  assert.deepEqual([...attendance], [[2, "justificada"], [3, "presente"]]);
  assert.equal(attendance.size, 2);
  assert.equal(inserts, 1);
  assert.equal(commits, 3);
});

test("rechaza alumnos de otro día y revierte la transacción", async () => {
  const response = await call("put", `${path}/:sesionId/asistencia`, {
    asistencias: [{ alumno_id: 1, estado: "presente" }, { alumno_id: 3, estado: "presente" }],
  });
  assert.equal(response.statusCode, 400);
  assert.equal(rollbacks, 1);
  assert.equal(attendance.get(2), "justificada");
});

test("el lunes muestra otra lista y no crea sesión fuera del horario del grupo", async () => {
  const monday = await call("get", path, { fecha: "2026-09-21" });
  assert.deepEqual(monday.body.alumnos.map((item) => item.id), [1, 3]);
  const offDay = await call("post", path, { fecha: "2026-09-23", asistencias: [] });
  assert.equal(offDay.statusCode, 400);
  assert.equal(inserts, 1);
});

test("profesor activo puede controlar un grupo sin profesor habitual y queda como docente de la sesión", async () => {
  const groups = await call("get", "/grupos", {}, "profesor");
  assert.equal(groups.statusCode, 200);
  assert.deepEqual(groups.body.grupos.map((group) => group.id), [8]);
  assert.equal(groups.body.profesor_actual_id, 51);

  const visible = await call("get", path, { fecha: "2026-09-21" }, "profe");
  assert.equal(visible.statusCode, 200);
  assert.equal(visible.body.profesor_actual_id, 51);

  const saved = await call("post", path, {
    fecha: "2026-09-21", estado: "dada",
    asistencias: [{ alumno_id: 1, estado: "presente" }, { alumno_id: 3, estado: "justificada" }],
  }, "profesor");
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.sesion.profesor_id, 51);
  assert.equal(saved.body.sesion.estado, "dada");

  const adminClear = await call("put", `${path}/:sesionId/asistencia`, {
    fecha: "2026-09-21", profesor_id: null,
  });
  assert.equal(adminClear.body.sesion.profesor_id, null);

  const professorUpdate = await call("put", `${path}/:sesionId/asistencia`, {
    fecha: "2026-09-21", estado: "dada",
  }, "profe");
  assert.equal(professorUpdate.body.sesion.profesor_id, 51);
});

test("profesor inactivo o usuario ajeno a staff no accede", async () => {
  professorActive = false;
  const inactive = await call("get", path, {}, "profesor");
  assert.equal(inactive.statusCode, 403);
  assert.equal((await call("get", "/grupos", {}, "profesor")).statusCode, 403);
  professorActive = true;
  professorLinked = false;
  assert.equal((await call("get", path, {}, "profe")).statusCode, 403);
  professorLinked = true;
  const nonStaff = await call("get", path, {}, "alumno");
  assert.equal(nonStaff.statusCode, 403);
  assert.equal((await call("get", "/grupos", {}, "alumno")).statusCode, 403);
});
