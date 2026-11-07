import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

import { ahoraEnClub, esHoraPasada } from "../services/horarioClub.js";

const consultas = [];
let inserts = 0;
let filasMias = [];

async function query(sql, params = []) {
  consultas.push({ sql, params });
  if (sql.startsWith("SHOW COLUMNS FROM reservas_pista")) {
    return [["id", "usuario_id", "tipo_reserva", "max_jugadores", "nivel_min", "nivel_max", "estado"].map((Field) => ({ Field }))];
  }
  if (sql.startsWith("SHOW TABLES LIKE")) return [[{ tabla: "reservas_pista_participantes" }]];
  if (sql.includes("FROM reservas_pista r") && sql.includes("JOIN pistas p")) return [filasMias];
  if (sql.includes("FROM reservas_pista") && sql.includes("FOR UPDATE")) return [[]];
  if (sql.startsWith("INSERT INTO reservas_pista")) {
    inserts += 1;
    return [{ insertId: 77 }];
  }
  return [[]];
}

globalThis.__reservasTestDb = {
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
    if (url.endsWith("/db/connection.js")) {
      return { format: "module", shortCircuit: true, source: "export const db = globalThis.__reservasTestDb;" };
    }
    if (url.endsWith("/services/notificationService.js")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export const NOTIFICATION_EVENTS = new Proxy({}, { get: (_t, k) => String(k) }); export async function notifyEvent() {}",
      };
    }
    return nextLoad(url, context);
  },
});

const { default: router } = await import("../routes/reservas.js");

async function call(method, path, { body = {}, query: q = {} } = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ params: {}, query: q, body, user: { id: 5, rol: "alumno", nombre: "Ana" } }, res);
  return res;
}

test("esHoraPasada compara en hora de Madrid", () => {
  // 5 de noviembre de 2026, 18:05 en Madrid (17:05 UTC).
  const ahora = new Date("2026-11-05T17:05:00Z");
  assert.deepEqual(ahoraEnClub(ahora), { fecha: "2026-11-05", hora: "18:05" });
  assert.equal(esHoraPasada("2026-11-05", "18:00", ahora), true);
  assert.equal(esHoraPasada("2026-11-05", "18:05:00", ahora), true);
  assert.equal(esHoraPasada("2026-11-05", "19:30", ahora), false);
  assert.equal(esHoraPasada("2026-11-04", "22:30", ahora), true);
  assert.equal(esHoraPasada("2026-11-06", "09:00", ahora), false);
  // Pasada la medianoche UTC sigue siendo el mismo día en Madrid.
  assert.equal(ahoraEnClub(new Date("2026-11-05T23:30:00Z")).fecha, "2026-11-06");
  assert.equal(esHoraPasada("", "10:00", ahora), false);
});

test("POST /api/reservas rechaza una hora que ya ha pasado sin tocar la BD", async () => {
  inserts = 0;
  const res = await call("post", "/", {
    body: { tipo_reserva: "completa", pista_id: 1, fecha: "2020-01-01", hora_inicio: "09:00" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.message, /ya ha pasado/);
  assert.equal(inserts, 0);
});

test("POST /api/reservas sigue aceptando horas futuras", async () => {
  inserts = 0;
  const res = await call("post", "/", {
    body: { tipo_reserva: "completa", pista_id: 1, fecha: "2099-01-01", hora_inicio: "09:00", nombre_cliente: "Ana" },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(inserts, 1);
});

test("GET /api/reservas/mias devuelve solo las próximas del usuario", async () => {
  consultas.length = 0;
  filasMias = [
    { id: 1, usuario_id: 5, pista_id: 1, pista_nombre: "Pista 1", fecha: "2020-01-01", hora_inicio: "09:00", duracion_min: 90, estado: "confirmada", tipo_reserva: "completa" },
    { id: 2, usuario_id: 5, pista_id: 2, pista_nombre: "Pista 2", fecha: "2099-03-01", hora_inicio: "18:00", duracion_min: 90, estado: "confirmada", tipo_reserva: "completa" },
    { id: 3, usuario_id: 8, pista_id: 1, pista_nombre: "Pista 1", fecha: "2099-03-02", hora_inicio: "19:30", duracion_min: 90, estado: "abierta", tipo_reserva: "abierta" },
  ];
  const res = await call("get", "/mias");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.reservas.map((r) => r.id), [2, 3]);
  assert.equal(res.body.reservas[0].es_mia, true);
  assert.equal(res.body.reservas[1].es_mia, false);

  const consulta = consultas.find((c) => c.sql.includes("JOIN pistas p"));
  assert.match(consulta.sql, /r\.estado != 'cancelada'/);
  assert.match(consulta.sql, /DATE_FORMAT\(r\.fecha/);
  assert.deepEqual(consulta.params.slice(1), [5, 5]);
});
