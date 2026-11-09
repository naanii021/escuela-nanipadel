import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { crearContactoRouter } from "../routes/contacto.js";
import { CorreoNoDisponibleError, enviarCorreoClub, leerConfigCorreo } from "../services/emailService.js";

const VALIDO = {
  paraQuien: "hijo",
  edad: 9,
  nivel: "alguna_vez",
  franjas: ["tarde"],
  dias: ["L", "X"],
  nombre: "Marta Pérez",
  telefono: "656 85 07 29",
  email: "marta@example.com",
  mensaje: "Tiene un amigo que también quiere venir.",
  web: "",
};

async function servidor(opciones) {
  const enviados = [];
  const app = express();
  app.use(express.json());
  app.use("/api/contacto", crearContactoRouter({
    configurado: () => true,
    enviar: async (m) => { enviados.push(m); },
    ...opciones,
  }));
  const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}/api/contacto/grupo`;
  const post = async (body, headers = {}) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  return { post, enviados, cerrar: () => new Promise((r) => srv.close(r)) };
}

test("envío correcto: asunto, cuerpo con las 4 respuestas y replyTo", async () => {
  const s = await servidor();
  const r = await s.post(VALIDO);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(s.enviados.length, 1);
  const m = s.enviados[0];
  assert.equal(m.asunto, "Nueva consulta de clases: Marta Pérez");
  assert.equal(m.replyTo, "marta@example.com");
  assert.match(m.texto, /1\. ¿Para quién es la clase\? Para mi hijo o hija \(9 años\)/);
  assert.match(m.texto, /2\. Nivel: Ha jugado alguna vez/);
  assert.match(m.texto, /3\. Horarios.*Tardes/);
  assert.match(m.texto, /Días: Lunes, Miércoles/);
  assert.match(m.texto, /Teléfono: 656 85 07 29/);
  assert.match(m.texto, /amigo/);
  await s.cerrar();
});

test("sin correo del interesado no hay replyTo", async () => {
  const s = await servidor();
  await s.post({ ...VALIDO, email: "" });
  assert.equal(s.enviados[0].replyTo, undefined);
  await s.cerrar();
});

test("validaciones devuelven 400 con mensaje claro y no envían", async () => {
  const s = await servidor();
  const casos = [
    [{ ...VALIDO, paraQuien: "otro" }, /para quién/i],
    [{ ...VALIDO, edad: "" }, /edad/i],
    [{ ...VALIDO, edad: 150 }, /edad/i],
    [{ ...VALIDO, nivel: "pro" }, /nivel/i],
    [{ ...VALIDO, franjas: [] }, /franja/i],
    [{ ...VALIDO, franjas: ["madrugada"] }, /franjas/i],
    [{ ...VALIDO, dias: ["Z"] }, /días/i],
    [{ ...VALIDO, nombre: " " }, /nombre/i],
    [{ ...VALIDO, telefono: "abc" }, /teléfono/i],
    [{ ...VALIDO, telefono: "123" }, /teléfono/i],
    [{ ...VALIDO, email: "no-es-correo" }, /correo/i],
    [{ ...VALIDO, mensaje: 42 }, /comentario/i],
    [{ ...VALIDO, paraQuien: "__proto__" }, /para quién/i],
  ];
  for (const [cuerpo, patron] of casos) {
    const r = await s.post(cuerpo);
    assert.equal(r.status, 400, JSON.stringify(cuerpo));
    assert.equal(r.json.ok, false);
    assert.match(r.json.message, patron);
  }
  assert.equal(s.enviados.length, 0);
  await s.cerrar();
});

test("un comentario largo se recorta a 500 caracteres", async () => {
  const s = await servidor();
  await s.post({ ...VALIDO, mensaje: "a".repeat(2000) });
  assert.ok(!s.enviados[0].texto.includes("a".repeat(501)));
  await s.cerrar();
});

test("honeypot: responde ok pero no envía", async () => {
  const s = await servidor();
  const r = await s.post({ ...VALIDO, web: "http://spam.example" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(s.enviados.length, 0);
  await s.cerrar();
});

test("límite por IP: el sexto envío recibe 429", async () => {
  const s = await servidor({ limitePorIp: 5 });
  for (let i = 0; i < 5; i += 1) assert.equal((await s.post(VALIDO, { "X-Forwarded-For": "1.2.3.4" })).status, 200);
  const r = await s.post(VALIDO, { "X-Forwarded-For": "1.2.3.4" });
  assert.equal(r.status, 429);
  assert.equal(r.json.ok, false);
  // Otra IP sigue pudiendo enviar.
  assert.equal((await s.post(VALIDO, { "X-Forwarded-For": "5.6.7.8" })).status, 200);
  await s.cerrar();
});

test("el límite se libera pasada la ventana", async () => {
  let t = 1000;
  const s = await servidor({ limitePorIp: 1, ventanaMs: 100, ahora: () => t });
  assert.equal((await s.post(VALIDO)).status, 200);
  assert.equal((await s.post(VALIDO)).status, 429);
  t += 200;
  assert.equal((await s.post(VALIDO)).status, 200);
  await s.cerrar();
});

test("sin correo configurado responde 503", async () => {
  const s = await servidor({ configurado: () => false });
  const r = await s.post(VALIDO);
  assert.equal(r.status, 503);
  assert.equal(r.json.ok, false);
  assert.match(r.json.message, /WhatsApp/);
  await s.cerrar();
});

test("si el paquete no está instalado también es 503; otro fallo es 502", async () => {
  let s = await servidor({ enviar: async () => { throw new CorreoNoDisponibleError(); } });
  assert.equal((await s.post(VALIDO)).status, 503);
  await s.cerrar();
  const log = console.error;
  console.error = () => {};
  s = await servidor({ enviar: async () => { throw new Error("SMTP caído"); } });
  const r = await s.post(VALIDO);
  console.error = log;
  assert.equal(r.status, 502);
  assert.doesNotMatch(r.json.message, /SMTP/);
  await s.cerrar();
});

test("sin inyección de cabeceras: saltos de línea fuera de asunto y replyTo", async () => {
  const s = await servidor();
  const r = await s.post({ ...VALIDO, nombre: "Ana\r\nBcc: victima@example.com", email: "" });
  assert.equal(r.status, 200);
  assert.ok(!/[\r\n]/.test(s.enviados[0].asunto));
  assert.equal(s.enviados[0].asunto, "Nueva consulta de clases: Ana Bcc: victima@example.com");

  const r2 = await s.post({ ...VALIDO, email: "a@example.com\r\nBcc: victima@example.com" });
  assert.equal(r2.status, 400);
  const r3 = await s.post({ ...VALIDO, email: "a@example.com,b@example.com" });
  assert.equal(r3.status, 400);
  await s.cerrar();
});

test("servicio de correo: configuración, destino por defecto y transporte inyectado", async () => {
  assert.equal(leerConfigCorreo({}), null);
  const env = { SMTP_HOST: "smtp.example.com", SMTP_USER: "club@example.com", SMTP_PASS: "x", SMTP_PORT: "465" };
  const cfg = leerConfigCorreo(env);
  assert.equal(cfg.to, "nanipadelcc@gmail.com");
  assert.equal(cfg.secure, true);
  assert.equal(cfg.from, "club@example.com");

  let creado = null;
  const enviados = [];
  const info = await enviarCorreoClub(
    { asunto: "Hola", texto: "Cuerpo", replyTo: "a@example.com" },
    { env, crearTransporte: async (c) => { creado = c; return { sendMail: async (m) => { enviados.push(m); return { messageId: "1" }; } }; } },
  );
  assert.equal(info.messageId, "1");
  assert.equal(creado.host, "smtp.example.com");
  assert.deepEqual(enviados[0], { from: "club@example.com", to: "nanipadelcc@gmail.com", subject: "Hola", text: "Cuerpo", replyTo: "a@example.com" });

  await assert.rejects(enviarCorreoClub({ asunto: "a", texto: "b" }, { env: {} }), CorreoNoDisponibleError);
});
