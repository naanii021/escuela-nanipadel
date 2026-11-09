import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach } from "node:test";
import bcrypt from "bcrypt";

const store = { hash: null, updates: 0 };

globalThis.__perfilPasswordDb = {
  promise: () => ({
    query: async (sql, params = []) => {
      if (sql.startsWith("SELECT password_hash FROM usuarios")) {
        return [store.hash && Number(params[0]) === 7 ? [{ password_hash: store.hash }] : []];
      }
      if (sql.startsWith("UPDATE usuarios SET password_hash")) {
        assert.equal(Number(params[1]), 7);
        store.hash = params[0];
        store.updates += 1;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  }),
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__perfilPasswordDb;" };
    }
    return nextLoad(url, context);
  },
});

process.env.JWT_SECRET ||= "test-secret";
const { default: router, resetPasswordAttempts } = await import("../routes/perfil.js");
const jwt = (await import("jsonwebtoken")).default;
const { JWT_SECRET } = await import("../config/security.js");

const layer = router.stack.find((l) => l.route?.path === "/password" && l.route.methods.put);
const authMiddleware = router.stack[0].handle; // requireAuth (router.use)

async function call(body, { token = jwt.sign({ id: 7, rol: "alumno" }, JWT_SECRET), ip = "1.1.1.1" } = {}) {
  const res = {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(k, v) { this.headers[k] = v; return this; },
    type() { return this; },
    json(value) { this.body = value; return this; },
  };
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, body, ip };
  let passed = false;
  authMiddleware(req, res, () => { passed = true; });
  if (!passed) return res;
  await layer.route.stack.at(-1).handle(req, res);
  return res;
}

beforeEach(async () => {
  resetPasswordAttempts();
  store.hash = await bcrypt.hash("Temporal123", 10);
  store.updates = 0;
});

test("cambia la contraseña y el hash nuevo valida con bcrypt (10 rondas)", async () => {
  const res = await call({ actual: "Temporal123", nueva: "NuevaClave456" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(store.updates, 1);
  assert.equal(await bcrypt.compare("NuevaClave456", store.hash), true);
  assert.equal(await bcrypt.compare("Temporal123", store.hash), false);
  assert.equal(bcrypt.getRounds(store.hash), 10);
});

test("contraseña actual incorrecta: 403 (nunca 401) y no guarda", async () => {
  const res = await call({ actual: "equivocada", nueva: "NuevaClave456" });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /actual no es correcta/);
  assert.equal(store.updates, 0);
});

test("nueva demasiado corta: 400", async () => {
  const res = await call({ actual: "Temporal123", nueva: "corta" });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /al menos 8/);
  assert.equal(store.updates, 0);
});

test("nueva demasiado larga (más de 72 bytes): 400", async () => {
  const res = await call({ actual: "Temporal123", nueva: "a".repeat(73) });
  assert.equal(res.statusCode, 400);
  assert.equal(store.updates, 0);
});

test("nueva igual a la actual: 400", async () => {
  const res = await call({ actual: "Temporal123", nueva: "Temporal123" });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /distinta/);
  assert.equal(store.updates, 0);
});

test("campos ausentes o de otro tipo: 400", async () => {
  assert.equal((await call({})).statusCode, 400);
  assert.equal((await call({ actual: 1, nueva: ["x"] })).statusCode, 400);
});

test("tras 5 fallos bloquea con 429 y Retry-After, incluso con la contraseña correcta", async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await call({ actual: "mal", nueva: "NuevaClave456" })).statusCode, 403);
  const res = await call({ actual: "Temporal123", nueva: "NuevaClave456" });
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
  assert.equal(store.updates, 0);
});

test("un éxito reinicia el contador de fallos del usuario", async () => {
  for (let i = 0; i < 4; i += 1) await call({ actual: "mal", nueva: "NuevaClave456" }, { ip: "9.9.9.9" });
  assert.equal((await call({ actual: "Temporal123", nueva: "NuevaClave456" }, { ip: "9.9.9.9" })).statusCode, 200);
  assert.equal((await call({ actual: "mal", nueva: "OtraClave7890" }, { ip: "9.9.9.9" })).statusCode, 403);
});

test("sin sesión o con token inválido: 401 y no toca la BD", async () => {
  assert.equal((await call({ actual: "Temporal123", nueva: "NuevaClave456" }, { token: null })).statusCode, 401);
  assert.equal((await call({ actual: "Temporal123", nueva: "NuevaClave456" }, { token: "falso" })).statusCode, 401);
  assert.equal(store.updates, 0);
});
