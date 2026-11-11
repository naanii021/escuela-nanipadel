import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { consultaGp, gp, resetGp } from "./helpers/grupo-profesores.js";

// Qué usuarios puede listar cada rol en GET /api/gestion/usuarios: el coordinador (admin) todos;
// un profesor, solo los alumnos de sus grupos y ningún otro profesor.
const calls = [];
let professorLinked = true;

async function query(sql, params = []) {
  const gpRes = consultaGp(sql, params);
  if (gpRes) return gpRes;
  if (sql === "SHOW COLUMNS FROM profesores") return [[{ Field: "id" }, { Field: "usuario_id" }, { Field: "activo" }]];
  if (sql.startsWith("SELECT id FROM profesores WHERE ")) return [professorLinked ? [{ id: 51 }] : []];
  if (sql.includes("FROM usuarios u")) {
    calls.push({ sql, params });
    return [[{ id: 7, nombre: "Ana", apellidos: "A", email: "a@x.es", rol: "alumno", alumno_id: 3, grupos: "Grupo 1" }]];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__gestionTestDb = { promise: () => ({ query }) };

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

async function listar(rol, search = {}) {
  const route = router.stack.find((layer) => layer.route?.path === "/usuarios" && layer.route.methods.get).route;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await route.stack.at(-1).handle({ query: search, user: { id: 99, rol } }, res);
  return res;
}

test("el admin lista usuarios sin filtro de grupos", async () => {
  calls.length = 0;
  const res = await listar("admin", { rol: "alumno" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.usuarios.length, 1);
  assert.doesNotMatch(calls[0].sql, /gr\.profesor_id/);
  assert.deepEqual(calls[0].params, [50]);
});

test("un profesor solo lista a los alumnos de sus grupos", async () => {
  resetProfessorColumnsCache?.();
  professorLinked = true;
  calls.length = 0;
  const res = await listar("profesor", { rol: "alumno", search: "an" });
  assert.equal(res.statusCode, 200);
  assert.match(calls[0].sql, /gr\.profesor_id = \?/);
  assert.match(calls[0].sql, /a\.id/);
  // Primero su ficha (51), después los cuatro patrones de búsqueda y el límite.
  assert.deepEqual(calls[0].params, [51, "%an%", "%an%", "%an%", "%an%", 50]);
});

test("un profesor no puede listar a otros profesores ni a nadie sin ficha de profesor", async () => {
  resetProfessorColumnsCache?.();
  professorLinked = true;
  calls.length = 0;
  const otros = await listar("profesor", { rol: "profesor" });
  assert.deepEqual(otros.body.usuarios, []);
  assert.equal(calls.length, 0);

  professorLinked = false;
  const sinFicha = await listar("profe", { rol: "alumno" });
  assert.deepEqual(sinFicha.body.usuarios, []);
  assert.equal(calls.length, 0);
});

test("con la tabla grupo_profesores, un profesor lista también a los alumnos de los grupos que comparte", async () => {
  resetProfessorColumnsCache?.();
  resetGrupoProfesoresCache();
  resetGp();
  gp.tabla = true;
  professorLinked = true;
  calls.length = 0;
  try {
    const res = await listar("profesor", { rol: "alumno" });
    assert.equal(res.statusCode, 200);
    assert.match(calls[0].sql, /gr\.profesor_id = \? OR EXISTS \(SELECT 1 FROM grupo_profesores gp_gr WHERE gp_gr\.grupo_id = gr\.id AND gp_gr\.profesor_id = \?\)/);
    assert.deepEqual(calls[0].params, [51, 51, 50]);

    // el admin sigue sin filtro
    calls.length = 0;
    await listar("admin", { rol: "alumno" });
    assert.doesNotMatch(calls[0].sql, /grupo_profesores/);
  } finally {
    resetGrupoProfesoresCache();
    resetGp();
  }
});
