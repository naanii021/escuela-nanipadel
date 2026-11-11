import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { consultaGp, gp, resetGp } from "./helpers/grupo-profesores.js";

// /resumen con el alcance de grupos compartidos y asignación de profesores_ids en POST/PUT /grupos.
const columns = {
  alumnos: ["id", "nombre", "apellidos", "nivel", "activo"],
  alumno_curso: ["alumno_id", "curso_id", "sede_id", "estado", "fecha_baja"],
  grupos: ["id", "codigo", "nombre", "nivel", "profesor_id", "dia1", "dia2", "hora_inicio", "duracion_min", "pista_habitual", "cupo", "activo", "curso_id", "sede_id"],
  profesores: ["id", "nombre", "apellidos", "activo"],
  pistas: ["id", "nombre"],
};
let activeProfessors = new Set([1, 3, 4, 5]);
let resumenQueries = [];
let writes = [];
let commits = 0;
let rollbacks = 0;

async function query(sql, params = []) {
  const gpRes = consultaGp(sql, params);
  if (gpRes) return gpRes;
  if (sql.startsWith("SHOW COLUMNS FROM ")) return [columns[sql.slice("SHOW COLUMNS FROM ".length)].map((Field) => ({ Field }))];
  if (sql.includes("FROM cursos_escolares c")) return [[{ curso_id: 3, curso_nombre: "Curso", sede_id: 2, sede_nombre: "Seminario Diocesano" }]];
  if (sql.startsWith("SELECT id FROM profesores WHERE id IN")) {
    assert.match(sql, /activo = 1/);
    return [params.filter((id) => activeProfessors.has(Number(id))).map((id) => ({ id }))];
  }
  if (sql.startsWith("SELECT id FROM profesores WHERE ")) return [[{ id: 3 }]]; // la ficha de Juanjo
  if (sql.includes("FROM alumnos a") && sql.includes("JOIN alumno_curso ac")) {
    if (sql.includes("grupo_ids")) resumenQueries.push({ sql, params });
    return [[]];
  }
  if (sql.includes("FROM grupos g") && sql.includes("LEFT JOIN alumno_curso ac")) {
    resumenQueries.push({ sql, params });
    return [[
      { id: 8, nombre: "Niños competición", dia1: "L", dia2: "M", activo: 1, profesor_id: 1, profesor: "Dani Iglesias", alumno_id: null },
    ]];
  }
  if (sql.includes("FROM profesores") || sql.includes("FROM pistas")) return [[]];
  if (sql.startsWith("INSERT INTO grupos") || sql.startsWith("UPDATE grupos") || sql.includes("INTO grupo_profesores") || sql.startsWith("DELETE FROM grupo_profesores")) {
    writes.push({ sql, params });
    return [{ insertId: 41, affectedRows: 1 }];
  }
  if (sql.startsWith("SELECT id FROM grupos WHERE id = ?")) return [params[0] === "404" ? [] : [{ id: Number(params[0]) }]];
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__gestionTestDb = {
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
    if (url.endsWith("/db/connection.js")) {
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
const { resetProfessorColumnsCache } = await import("../routes/gestionControl.js");
const { resetGrupoProfesoresCache } = await import("../services/profesoresGrupo.js");

function preparar({ tabla }) {
  resetGp();
  resetGrupoProfesoresCache();
  resetProfessorColumnsCache();
  gp.tabla = tabla;
  resumenQueries = [];
  writes = [];
  commits = 0;
  rollbacks = 0;
}

async function call(method, path, user, body = {}, params = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await route.stack.at(-1).handle({ params, body, query: {}, user }, res);
  return res;
}

const admin = { id: 1, rol: "admin" };
const juanjo = { id: 9, rol: "profesor", email: "juanjo@x.es" };

test("/resumen de un profesor con tabla: ve los grupos en los que está y recibe todos sus profesores", async () => {
  preparar({ tabla: true });
  gp.profesores.set(8, [{ id: 1, nombre: "Dani", apellidos: "Iglesias" }, { id: 3, nombre: "Juanjo", apellidos: "Alonso" }]);
  const res = await call("get", "/resumen", juanjo);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(resumenQueries.length, 2);
  for (const consulta of resumenQueries) {
    assert.match(consulta.sql, /g\.profesor_id = \? OR EXISTS \(SELECT 1 FROM grupo_profesores gp_g/);
    assert.deepEqual(consulta.params, [3, 2, 3, 3]);
  }
  // la lista de profesores por alumno también incluye a los del grupo compartido
  assert.match(resumenQueries[0].sql, /p\.id IN \(SELECT gp_j\.profesor_id FROM grupo_profesores gp_j/);
  const [grupo] = res.body.grupos;
  assert.equal(grupo.compartido, true);
  assert.deepEqual(grupo.profesores_ids, [1, 3]);
  assert.equal(grupo.profesor, "Dani Iglesias y Juanjo Alonso");
  assert.equal(grupo.profesor_id, 1);
});

test("/resumen sin tabla: filtro por grupos.profesor_id como siempre; el admin sin filtro", async () => {
  preparar({ tabla: false });
  await call("get", "/resumen", juanjo);
  for (const consulta of resumenQueries) {
    assert.match(consulta.sql, /AND g\.profesor_id = \?/);
    assert.doesNotMatch(consulta.sql, /grupo_profesores/);
  }
  assert.deepEqual(resumenQueries[0].params, [3, 2, 3]);
  assert.deepEqual(resumenQueries[1].params, [3, 2, 3]);

  preparar({ tabla: true });
  const res = await call("get", "/resumen", admin);
  assert.equal(res.statusCode, 200);
  for (const consulta of resumenQueries) assert.deepEqual(consulta.params, [3, 2]);
});

test("crear grupo con profesores_ids: el primero es profesor_id y se sincroniza la tabla en una transacción", async () => {
  preparar({ tabla: true });
  const res = await call("post", "/grupos", admin, { nombre: "Niños competición", dia1: "L", hora_inicio: "18:00:00", profesores_ids: [1, 3] });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const insert = writes.find((w) => w.sql.startsWith("INSERT INTO grupos"));
  const campos = insert.sql.match(/\(([^)]*)\) VALUES/)[1].split(",").map((c) => c.trim());
  assert.equal(insert.params[campos.indexOf("profesor_id")], 1);
  assert.deepEqual(writes.filter((w) => w.sql.includes("INTO grupo_profesores")).map((w) => w.params), [[41, 1], [41, 3]]);
  assert.match(writes.find((w) => w.sql.startsWith("DELETE FROM grupo_profesores")).sql, /NOT IN/);
  assert.equal(commits, 1);
});

test("editar grupo con profesores_ids: actualiza profesor_id y la tabla; con un solo profesor funciona igual", async () => {
  preparar({ tabla: true });
  const res = await call("put", "/grupos/:id", admin, { nombre: "Niños", profesores_ids: [3, 1, 4] }, { id: "8" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const update = writes.find((w) => w.sql.startsWith("UPDATE grupos"));
  assert.match(update.sql, /profesor_id = \?/);
  assert.equal(update.params[update.params.length - 2], 3);
  assert.deepEqual(writes.filter((w) => w.sql.includes("INTO grupo_profesores")).map((w) => w.params[1]), [3, 1, 4]);

  // quitar a todos
  preparar({ tabla: true });
  const vacio = await call("put", "/grupos/:id", admin, { profesores_ids: [] }, { id: "8" });
  assert.equal(vacio.statusCode, 200);
  assert.ok(writes.some((w) => w.sql === "DELETE FROM grupo_profesores WHERE grupo_id = ?"));
  const update2 = writes.find((w) => w.sql.startsWith("UPDATE grupos"));
  assert.equal(update2.params[0], null);

  // grupo inexistente
  preparar({ tabla: true });
  const noExiste = await call("put", "/grupos/:id", admin, { profesores_ids: [1] }, { id: "404" });
  assert.equal(noExiste.statusCode, 404);
  assert.equal(rollbacks, 1);
});

test("profesores_ids: validaciones (lista, ids, duplicados, máximo 4, existentes y activos)", async () => {
  preparar({ tabla: true });
  const casos = [
    [{ profesores_ids: "1" }, /lista/],
    [{ profesores_ids: [1, "x"] }, /no valido/],
    [{ profesores_ids: [0] }, /no valido/],
    [{ profesores_ids: [1, 3, 1] }, /repetidos/],
    [{ profesores_ids: [1, 3, 4, 5, 6] }, /maximo 4/],
    [{ profesores_ids: [1, 99] }, /no existe o no esta activo/],
  ];
  for (const [cuerpo, mensaje] of casos) {
    for (const [metodo, ruta, params] of [["post", "/grupos", {}], ["put", "/grupos/:id", { id: "8" }]]) {
      const res = await call(metodo, ruta, admin, { nombre: "G", hora_inicio: "10:00:00", ...cuerpo }, params);
      assert.equal(res.statusCode, 400, `${metodo} ${JSON.stringify(cuerpo)}`);
      assert.match(res.body.message, mensaje);
    }
  }
  assert.equal(writes.length, 0, "ningún caso inválido escribe");
});

test("profesores_ids sin la tabla: con más de uno responde 409 y no guarda; con uno funciona como siempre", async () => {
  preparar({ tabla: false });
  for (const [metodo, ruta, params] of [["post", "/grupos", {}], ["put", "/grupos/:id", { id: "8" }]]) {
    const res = await call(metodo, ruta, admin, { nombre: "G", hora_inicio: "10:00:00", profesores_ids: [1, 3] }, params);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /Para asignar varios profesores hay que aplicar antes la migración grupo_profesores/);
  }
  assert.equal(writes.length, 0);

  const uno = await call("post", "/grupos", admin, { nombre: "G", hora_inicio: "10:00:00", profesores_ids: [3] });
  assert.equal(uno.statusCode, 201, JSON.stringify(uno.body));
  assert.ok(writes.some((w) => w.sql.startsWith("INSERT INTO grupos")));
  assert.ok(!writes.some((w) => w.sql.includes("grupo_profesores")), "sin tabla no se toca grupo_profesores");
  const put = await call("put", "/grupos/:id", admin, { profesores_ids: [3] }, { id: "8" });
  assert.equal(put.statusCode, 200);
});

test("sin profesores_ids, crear y editar funcionan como siempre (profesor_id suelto)", async () => {
  preparar({ tabla: true });
  const res = await call("post", "/grupos", admin, { nombre: "G", hora_inicio: "10:00:00", profesor_id: 4 });
  assert.equal(res.statusCode, 201);
  assert.ok(!writes.some((w) => w.sql.includes("grupo_profesores")));
  const put = await call("put", "/grupos/:id", admin, { profesor_id: 5 }, { id: "8" });
  assert.equal(put.statusCode, 200);
  assert.ok(!writes.some((w) => w.sql.includes("grupo_profesores")));
});
