// Envío de correo del club con nodemailer, configurado por variables de entorno.
// Ver backend/CORREO.md. Si falta la configuración o el paquete, el envío se declara
// "no disponible" y las rutas responden 503 sin tumbar el backend.

const DESTINO_POR_DEFECTO = "nanipadelcc@gmail.com";

export class CorreoNoDisponibleError extends Error {
  constructor(message = "El envío de correo no está configurado.") {
    super(message);
    this.name = "CorreoNoDisponibleError";
    this.code = "CORREO_NO_DISPONIBLE";
  }
}

// Devuelve la configuración SMTP o null si no está completa.
export function leerConfigCorreo(env = process.env) {
  const host = String(env.SMTP_HOST || "").trim();
  const user = String(env.SMTP_USER || "").trim();
  const pass = String(env.SMTP_PASS || "");
  if (!host) return null;

  const port = Number(env.SMTP_PORT) || 587;
  const secure = String(env.SMTP_SECURE || "").trim().toLowerCase() === "true" || port === 465;
  const from = String(env.SMTP_FROM || "").trim() || user;
  if (!from) return null;

  const to = String(env.CONTACTO_EMAIL_DESTINO || "").trim() || DESTINO_POR_DEFECTO;
  return { host, port, secure, user, pass, from, to };
}

export function correoConfigurado(env = process.env) {
  return leerConfigCorreo(env) !== null;
}

async function crearTransporteNodemailer(config) {
  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    throw new CorreoNoDisponibleError("El paquete nodemailer no está instalado.");
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user ? { auth: { user: config.user, pass: config.pass } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// opciones: { env, crearTransporte(config) } -> para tests o para cambiar de proveedor.
export async function enviarCorreoClub({ asunto, texto, replyTo }, opciones = {}) {
  const { env = process.env, crearTransporte = crearTransporteNodemailer } = opciones;
  const config = leerConfigCorreo(env);
  if (!config) throw new CorreoNoDisponibleError();

  const transporte = await crearTransporte(config);
  const mensaje = {
    from: config.from,
    to: config.to,
    subject: asunto,
    text: texto,
    ...(replyTo ? { replyTo } : {}),
  };
  const info = await transporte.sendMail(mensaje);
  if (typeof transporte.close === "function") transporte.close();
  return info;
}
