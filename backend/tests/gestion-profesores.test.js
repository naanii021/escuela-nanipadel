import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import bcrypt from "bcrypt";

const profesores = [];
const usuarios = [];
const codigos = [];
let commits = 0;
let rollbacks = 0;
const logged = [];

function resetData() {
  profesores.length = 0;
  usuarios.length = 0;
  codigos.length = 0;
  commits = 0;
  rollbacks = 0;
  profesores.push(
    { id: 1, nombre: "Dani", apellidos: "Iglesias", usuario_id: 1, email: null, activo: 1, telegram_chat_id: "555", telegram_username: "dani" },
    { id: 2, nombre: "Alicia", apellidos: "Perez", usuario_id: null, email: null, activo: 1, telegram_chat_id: null, telegram_username: null },
    { id: 3, nombre: "Juanjo", apellidos: "Alonso", usuario_id: null, email: null, activo: 0, telegram_chat_id: null, telegram_username: null },
  );
  usuarios.push({ id: 1, email: "admin@escuela.test", rol: "admin", nombre: "Dani" });
}

const columns = {
  profesores: ["id", "nombre", "apellidos", "usuario_id", "email", "activo", "telegram_chat_id", "telegram_username"],
  usuarios: ["id", "nombre", "email", "password_hash", "rol", "activo", "telefono"],
};

async function query(sql, params = []) {
  if (sql.startsWith("SHOW COLUMNS FROM ")) {
    return [columns[sql.slice("SHOW COLUMNS FROM ".length)].map((Field) => ({ Field }))];
  }
  if (sql.includes("FROM profesores p") && sql.includes("LEFT JOIN usuarios u")) {
    return [profesores.map((p) => ({
      ...p,
      usuario_email: usuarios.find((u) => u.id === p.usuario_id)?.email ?? null,
      usuario_rol: usuarios.find((u) => u.id === p.usuario_id)?.rol ?? null,
    }))];
  }
  if (sql.startsWith("SELECT id FROM profesores WHERE (")) {
    const found = profesores.find((p) => p.activo === 1 && ((p.usuario_id && p.usuario_id === params[0]) || (params[1] && p.email === params[1])));
    return [found ? [{ id: found.id }] : []];
  }
  if (sql.startsWith("SELECT telegram_chat_id")) {
    const found = profesores.find((p) => p.id === params[0]);
    return [[{ telegram_chat_id: found.telegram_chat_id, telegram_username: found.telegram_username }]];
  }
  if (sql.includes("FROM profesores WHERE id = ? FOR UPDATE")) {
    const found = profesores.find((p) => String(p.id) === String(params[0]));
    return [found ? [{ ...found }] : []];
  }
  if (sql.startsWith("SELECT id FROM usuarios WHERE email")) {
    return [usuarios.filter((u) => u.email === params[0]).map((u) => ({ id: u.id }))];
  }
  if (sql.startsWith("INSERT INTO usuarios")) {
    const fields = sql.match(/\(([^)]*)\) VALUES/)[1].split(", ");
    const row = Object.fromEntries(fields.map((field, index) => [field, params[index]]));
    row.id = usuarios.length + 10;
    usuarios.push(row);
    return [{ insertId: row.id }];
  }
  if (sql.startsWith("UPDATE profesores SET usuario_id")) {
    const found = profesores.find((p) => p.id === params.at(-1));
    found.usuario_id = params[0];
    if (params.length === 3) found.email = params[1];
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("UPDATE telegram_profesor_codigos")) return [{ affectedRows: 0 }];
  if (sql.startsWith("INSERT INTO telegram_profesor_codigos")) {
    codigos.push({ profesor_id: params[0], hash: params[1] });
    return [{ insertId: codigos.length }];
  }
  throw new Error(`Consulta inesperada: ${sql}`);
}

globalThis.__profesoresTestDb = {
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
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__profesoresTestDb;" };
    }
    return nextLoad(url, context);
  },
});

const { default: router } = await import("../routes/gestion.js");
const { default: controlRouter } = await import("../routes/gestionControl.js");

async function call(routerToUse, method, path, { body = {}, params = {}, user = { id: 1, rol: "admin", email: "admin@escuela.test" } } = {}) {
  const route = routerToUse.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const req = { params, body, user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    type() { return this; },
    json(value) { this.body = value; return this; },
  };
  let index = 0;
  const pending = [];
  const next = () => {
    const layer = route.stack[index++];
    if (layer) pending.push(Promise.resolve(layer.handle(req, res, next)));
  };
  next();
  await Promise.all(pending);
  return res;
}

test("GET /profesores lista los profesores con su estado de acceso y Telegram (solo admin)", async () => {
  resetData();
  const res = await call(router, "get", "/profesores");
  assert.equal(res.statusCode, 200);
  const [dani, alicia, juanjo] = res.body.profesores;
  assert.deepEqual([dani.tiene_acceso, dani.telegram_vinculado, dani.telegram_username, dani.rol_acceso], [true, true, "dani", "admin"]);
  assert.deepEqual([alicia.tiene_acceso, alicia.telegram_vinculado, alicia.activo], [false, false, true]);
  assert.equal(juanjo.activo, false);
  assert.equal(res.body.profesores.length, 3);
  const forbidden = await call(router, "get", "/profesores", { user: { id: 5, rol: "profesor" } });
  assert.equal(forbidden.statusCode, 403);
});

test("crear-acceso: crea usuario profesor, enlaza ficha y email, sin devolver ni registrar la contraseña", async () => {
  resetData();
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const res = await call(router, "post", "/profesores/:id/crear-acceso", {
      params: { id: "2" }, body: { email: "  Alicia@Escuela.TEST ", password: "Temporal-2026" },
    });
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.equal(res.body.email, "alicia@escuela.test");
    assert.doesNotMatch(JSON.stringify(res.body), /Temporal-2026/);
    const user = usuarios.at(-1);
    assert.equal(user.rol, "profesor");
    assert.equal(user.email, "alicia@escuela.test");
    assert.notEqual(user.password_hash, "Temporal-2026");
    assert.ok(await bcrypt.compare("Temporal-2026", user.password_hash));
    assert.equal(bcrypt.getRounds(user.password_hash), 10);
    assert.equal(profesores[1].usuario_id, user.id);
    assert.equal(profesores[1].email, "alicia@escuela.test");
    assert.equal(commits, 1);
    assert.equal(logged.length, 0);
  } finally {
    console.error = originalError;
  }
});

test("crear-acceso: valida email y contraseña (mínimo 8) y no toca nada", async () => {
  resetData();
  const base = { params: { id: "2" } };
  for (const body of [{}, { email: "a@b.es" }, { email: "sin-arroba", password: "12345678" }, { email: "a@b.es", password: "1234567" }]) {
    const res = await call(router, "post", "/profesores/:id/crear-acceso", { ...base, body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(usuarios.length, 1);
  assert.equal(profesores[1].usuario_id, null);
});

test("crear-acceso: 403 sin ser admin, 404 inexistente y 409 por ficha con acceso, desactivada o email repetido", async () => {
  resetData();
  const ok = { email: "nuevo@escuela.test", password: "12345678" };
  assert.equal((await call(router, "post", "/profesores/:id/crear-acceso", { params: { id: "2" }, body: ok, user: { id: 9, rol: "profesor" } })).statusCode, 403);
  assert.equal((await call(router, "post", "/profesores/:id/crear-acceso", { params: { id: "99" }, body: ok })).statusCode, 404);
  assert.equal((await call(router, "post", "/profesores/:id/crear-acceso", { params: { id: "1" }, body: ok })).statusCode, 409);
  assert.equal((await call(router, "post", "/profesores/:id/crear-acceso", { params: { id: "3" }, body: ok })).statusCode, 409);
  const dup = await call(router, "post", "/profesores/:id/crear-acceso", { params: { id: "2" }, body: { ...ok, email: "ADMIN@escuela.test" } });
  assert.equal(dup.statusCode, 409);
  assert.match(dup.body.message, /ya existe un usuario/i);
  assert.equal(usuarios.length, 1);
  assert.ok(rollbacks >= 4);
});

test("link-code: un profesor y un admin con ficha activa obtienen código; el admin sin ficha, un mensaje claro", async () => {
  resetData();
  process.env.TELEGRAM_BOT_USERNAME = "@NaniBot";
  const admin = await call(controlRouter, "post", "/telegram/link-code");
  assert.equal(admin.statusCode, 200, JSON.stringify(admin.body));
  assert.equal(codigos.at(-1).profesor_id, 1);
  assert.match(admin.body.link, /^https:\/\/t\.me\/NaniBot\?start=/);
  assert.equal(admin.body.bot_username, "NaniBot");
  assert.ok(admin.body.command.startsWith("/start "));

  profesores[1].usuario_id = 20;
  const teacher = await call(controlRouter, "post", "/telegram/link-code", { user: { id: 20, rol: "profesor", email: "x@y.es" } });
  assert.equal(teacher.statusCode, 200);
  assert.equal(codigos.at(-1).profesor_id, 2);

  const adminSinFicha = await call(controlRouter, "post", "/telegram/link-code", { user: { id: 77, rol: "admin", email: "otro@admin.es" } });
  assert.equal(adminSinFicha.statusCode, 403);
  assert.match(adminSinFicha.body.message, /ficha de profesor/);

  const alumno = await call(controlRouter, "post", "/telegram/link-code", { user: { id: 30, rol: "alumno" } });
  assert.equal(alumno.statusCode, 403);
  delete process.env.TELEGRAM_BOT_USERNAME;
});

test("GET /telegram/estado indica si hay ficha y si Telegram está vinculado", async () => {
  resetData();
  const linked = await call(router, "get", "/telegram/estado");
  assert.deepEqual([linked.body.tiene_ficha, linked.body.vinculado, linked.body.telegram_username], [true, true, "dani"]);
  const none = await call(router, "get", "/telegram/estado", { user: { id: 77, rol: "admin", email: "otro@admin.es" } });
  assert.deepEqual([none.body.tiene_ficha, none.body.vinculado], [false, false]);
});
