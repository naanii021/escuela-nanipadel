import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { consultaGp } from "./helpers/grupo-profesores.js";

const columns = {
  grupos: [
    "id", "codigo", "nombre", "nivel", "profesor_id", "dia1", "dia2", "hora_inicio",
    "duracion_min", "pista_habitual", "cupo", "activo", "curso_id", "sede_id",
  ],
};
let activeContext = [{ curso_id: 3, curso_nombre: "Curso", sede_id: 2, sede_nombre: "Seminario Diocesano" }];
let inserted = null;

async function query(sql, params = []) {
  const gpRes = consultaGp(sql, params);
  if (gpRes) return gpRes;
  if (sql.startsWith("SHOW COLUMNS FROM ")) {
    return [columns[sql.slice("SHOW COLUMNS FROM ".length)].map((Field) => ({ Field }))];
  }
  if (sql.includes("FROM cursos_escolares c")) return [activeContext];
  if (sql.startsWith("INSERT INTO grupos")) {
    inserted = { sql, params };
    return [{ insertId: 41 }];
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

async function createGroup(body) {
  const route = router.stack.find((layer) => layer.route?.path === "/grupos" && layer.route.methods.post).route;
  const handler = route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ params: {}, body, user: { id: 1, rol: "admin" } }, res);
  return res;
}

test("crear un grupo lo asocia al curso y la sede activos", async () => {
  inserted = null;
  const res = await createGroup({ nombre: "Grupo A", dia1: "L", hora_inicio: "10:00:00" });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const fields = inserted.sql.match(/\(([^)]*)\) VALUES/)[1].split(",").map((field) => field.trim());
  assert.equal(inserted.params[fields.indexOf("curso_id")], 3);
  assert.equal(inserted.params[fields.indexOf("sede_id")], 2);
});

test("crear un grupo sin curso activo responde 409 y no inserta nada", async () => {
  inserted = null;
  activeContext = [];
  const res = await createGroup({ nombre: "Grupo B", hora_inicio: "10:00:00" });
  activeContext = [{ curso_id: 3, curso_nombre: "Curso", sede_id: 2, sede_nombre: "Seminario Diocesano" }];
  assert.equal(res.statusCode, 409);
  assert.equal(inserted, null);
});
