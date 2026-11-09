import express from "express";
import { CorreoNoDisponibleError, correoConfigurado, enviarCorreoClub } from "../services/emailService.js";

// Listas cerradas: lo que no esté aquí se rechaza.
export const OPCIONES = {
  paraQuien: { yo: "Para mí (adulto)", hijo: "Para mi hijo o hija" },
  nivel: {
    nunca: "Nunca ha jugado",
    alguna_vez: "Ha jugado alguna vez",
    regular: "Juega con regularidad",
  },
  franjas: { manana: "Mañanas", tarde: "Tardes", noche: "Noches" },
  dias: { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" },
};

const MSG_503 = "Ahora mismo no podemos enviar el correo desde la web. Escríbenos por WhatsApp y te respondemos igual.";

// Quita saltos de línea y caracteres de control: nada de lo que escribe el usuario
// puede acabar como una cabecera nueva del correo.
function limpiarLinea(valor, max) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function limpiarTexto(valor, max) {
  return String(valor ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function lista(valor, permitidos) {
  if (valor === undefined || valor === null || valor === "") return [];
  if (!Array.isArray(valor) || valor.length > 10) return null;
  const claves = Object.keys(permitidos);
  const salida = [];
  for (const item of valor) {
    if (typeof item !== "string" || !claves.includes(item)) return null;
    if (!salida.includes(item)) salida.push(item);
  }
  return claves.filter((k) => salida.includes(k)); // orden estable
}

// Devuelve { error } o { datos }.
export function validarConsulta(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Faltan los datos del formulario." };

  const paraQuien = body.paraQuien;
  if (typeof paraQuien !== "string" || !Object.hasOwn(OPCIONES.paraQuien, paraQuien)) {
    return { error: "Indica para quién es la clase." };
  }

  let edad = null;
  if (body.edad !== undefined && body.edad !== null && body.edad !== "") {
    const n = Number(body.edad);
    if (!Number.isInteger(n) || n < 3 || n > 99) return { error: "La edad debe ser un número entre 3 y 99." };
    edad = n;
  }
  if (paraQuien === "hijo" && edad === null) return { error: "Indica la edad de tu hijo o hija." };

  if (typeof body.nivel !== "string" || !Object.hasOwn(OPCIONES.nivel, body.nivel)) return { error: "Indica qué nivel tiene." };

  const franjas = lista(body.franjas, OPCIONES.franjas);
  if (franjas === null) return { error: "Las franjas horarias no son válidas." };
  if (franjas.length === 0) return { error: "Elige al menos una franja horaria (mañana, tarde o noche)." };

  const dias = lista(body.dias, OPCIONES.dias);
  if (dias === null) return { error: "Los días elegidos no son válidos." };

  const nombre = limpiarLinea(body.nombre, 80);
  if (nombre.length < 2) return { error: "Escribe tu nombre." };

  const telefonoBruto = limpiarLinea(body.telefono, 30);
  if (!/^[+\d\s().-]+$/.test(telefonoBruto)) return { error: "Escribe un teléfono válido, solo con números." };
  const digitos = telefonoBruto.replace(/\D/g, "");
  if (digitos.length < 9 || digitos.length > 15) return { error: "El teléfono debe tener entre 9 y 15 cifras." };

  let email = "";
  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    email = String(body.email).trim();
    if (email.length > 120 || !/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/.test(email)) {
      return { error: "El correo no parece válido. Revísalo o déjalo en blanco." };
    }
  }

  if (body.mensaje !== undefined && body.mensaje !== null && typeof body.mensaje !== "string") {
    return { error: "El comentario no es válido." };
  }
  const mensaje = limpiarTexto(body.mensaje, 500);

  return { datos: { paraQuien, edad, nivel: body.nivel, franjas, dias, nombre, telefono: telefonoBruto, email, mensaje } };
}

export function construirCorreo(d) {
  const quien = OPCIONES.paraQuien[d.paraQuien] + (d.edad ? ` (${d.edad} años)` : "");
  const franjas = d.franjas.map((f) => OPCIONES.franjas[f]).join(", ");
  const dias = d.dias.length ? d.dias.map((x) => OPCIONES.dias[x]).join(", ") : "Cualquier día";
  const lineas = [
    "Nueva consulta de clases desde la web",
    "",
    `1. ¿Para quién es la clase? ${quien}`,
    `2. Nivel: ${OPCIONES.nivel[d.nivel]}`,
    `3. Horarios que le vienen mejor: ${franjas}`,
    `   Días: ${dias}`,
    "4. Contacto",
    `   Nombre: ${d.nombre}`,
    `   Teléfono: ${d.telefono}`,
    `   Correo: ${d.email || "no indicado"}`,
    "",
    `¿Algo más? ${d.mensaje || "-"}`,
  ];
  return {
    asunto: `Nueva consulta de clases: ${d.nombre}`,
    texto: lineas.join("\n"),
    replyTo: d.email || undefined,
  };
}

// Opciones inyectables para los tests.
export function crearContactoRouter(opciones = {}) {
  const {
    enviar = enviarCorreoClub,
    configurado = () => correoConfigurado(),
    limitePorIp = 5,
    limiteGlobal = 40,
    ventanaMs = 60 * 60 * 1000,
    ahora = () => Date.now(),
  } = opciones;

  const router = express.Router();
  const porIp = new Map();
  let globales = [];

  function dentroDelLimite(ip) {
    const t = ahora();
    const desde = t - ventanaMs;
    globales = globales.filter((x) => x > desde);
    const propios = (porIp.get(ip) || []).filter((x) => x > desde);
    if (propios.length >= limitePorIp || globales.length >= limiteGlobal) {
      porIp.set(ip, propios);
      return false;
    }
    propios.push(t);
    globales.push(t);
    porIp.set(ip, propios);
    // Limpieza para que el mapa no crezca sin fin.
    if (porIp.size > 2000) {
      for (const [k, v] of porIp) if (!v.some((x) => x > desde)) porIp.delete(k);
    }
    return true;
  }

  // Detrás de Vercel/proxy la IP real llega en X-Forwarded-For. El tope global
  // evita que se pueda esquivar el límite inventando esa cabecera.
  function ipDe(req) {
    const reenviada = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return limpiarLinea(reenviada || req.ip || req.socket?.remoteAddress || "desconocida", 60);
  }

  // POST /api/contacto/grupo  (público)
  router.post("/grupo", async (req, res) => {
    const body = req.body;

    // Honeypot: campo oculto que una persona nunca rellena. Se responde "ok" sin enviar nada.
    if (body && typeof body === "object" && body.web !== undefined && body.web !== null && String(body.web).trim() !== "") {
      return res.json({ ok: true });
    }

    const { error, datos } = validarConsulta(body);
    if (error) return res.status(400).json({ ok: false, message: error });

    if (!configurado()) return res.status(503).json({ ok: false, message: MSG_503 });

    if (!dentroDelLimite(ipDe(req))) {
      return res.status(429).json({ ok: false, message: "Has enviado varias consultas seguidas. Espera un rato o escríbenos por WhatsApp." });
    }

    try {
      await enviar(construirCorreo(datos));
      return res.json({ ok: true });
    } catch (e) {
      if (e instanceof CorreoNoDisponibleError) return res.status(503).json({ ok: false, message: MSG_503 });
      console.error("Error POST /api/contacto/grupo:", e?.message || e);
      return res.status(502).json({ ok: false, message: "No hemos podido enviar tu consulta. Prueba por WhatsApp y te respondemos igual." });
    }
  });

  return router;
}

export default crearContactoRouter();
