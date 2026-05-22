import dotenv from "dotenv";

dotenv.config();

// Versión de la API de WhatsApp Cloud API.
// En tu .env tienes: WHATSAPP_API_VERSION=v25.0
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";

// Token privado de Meta.
// En tu .env tienes: WHATSAPP_TOKEN=...
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ID del número de teléfono de WhatsApp.
// Ojo: no es el +34..., es el Phone Number ID de Meta.
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Normaliza teléfonos para dejarlos en formato internacional.
// Ejemplos válidos:
// 622040926        -> +34622040926
// 34622040926      -> +34622040926
// +34622040926     -> +34622040926
// whatsapp:+346... -> +346...
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Convertimos el teléfono a texto y quitamos espacios
  let normalized = String(phone).trim();

  // Quitamos el prefijo whatsapp: si viniera de algún proveedor o webhook
  normalized = normalized.replace(/^whatsapp:/i, "");

  // Quitamos espacios, guiones, paréntesis y puntos
  normalized = normalized.replace(/\s+/g, "");
  normalized = normalized.replace(/[().-]/g, "");

  // Si empieza por 00, lo convertimos a formato internacional con +
  // Ejemplo: 0034622040926 -> +34622040926
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  // Si ya empieza por +, lo dejamos tal cual
  if (normalized.startsWith("+")) {
    return normalized;
  }

  // Si es un número español de 9 cifras, añadimos +34
  // Ejemplo: 622040926 -> +34622040926
  if (/^[679]\d{8}$/.test(normalized)) {
    return `+34${normalized}`;
  }

  // Si ya viene con prefijo internacional sin +
  // Ejemplo: 34622040926 -> +34622040926
  if (/^\d{10,15}$/.test(normalized)) {
    return `+${normalized}`;
  }

  // Si no encaja con nada, lo marcamos como inválido
  return null;
}

// Meta espera el destinatario sin el símbolo +
// Ejemplo: +34622040926 -> 34622040926
function toMetaRecipient(phone) {
  const normalized = normalizePhoneNumber(phone);

  if (!normalized) return null;

  return normalized.replace(/^\+/, "");
}

// Envía un mensaje de texto libre por WhatsApp.
// Sirve para pruebas y para responder dentro de la ventana de 24 horas.
// Para iniciar conversaciones automáticas fuera de esa ventana harán falta plantillas aprobadas.
export async function sendWhatsAppMessage({ to, body }) {
  // Comprobamos que el token existe en el .env
  if (!WHATSAPP_TOKEN) {
    throw new Error("Falta WHATSAPP_TOKEN en el .env");
  }

  // Comprobamos que el Phone Number ID existe en el .env
  if (!WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID en el .env");
  }

  // Comprobamos que se ha enviado un destinatario
  if (!to) {
    throw new Error("Falta el número de destino");
  }

  // Comprobamos que el mensaje tiene contenido
  if (!body) {
    throw new Error("Falta el contenido del mensaje");
  }

  // Convertimos el teléfono al formato que Meta espera
  const recipient = toMetaRecipient(to);

  // Si el número no es válido, paramos aquí
  if (!recipient) {
    throw new Error(`Número de destino no válido: ${to}`);
  }

  // Endpoint oficial de Meta para enviar mensajes
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Enviamos el mensaje a WhatsApp Cloud API
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
  });

  // Convertimos la respuesta de Meta a JSON
  const data = await response.json();

  // Si Meta responde con error, lo mostramos de forma clara
  if (!response.ok) {
    const metaError =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      "Error desconocido al enviar WhatsApp con Meta";

    throw new Error(metaError);
  }

  // Si todo va bien, devolvemos una respuesta limpia para usarla en otros servicios
  return {
    ok: true,
    provider: "meta",
    messageId: data?.messages?.[0]?.id || null,
    to: recipient,
    raw: data,
  };
}

// Alias cómodo por si quieres usar un nombre más claro en otras partes del backend
export async function enviarWhatsAppTexto(numeroDestino, mensaje) {
  return sendWhatsAppMessage({
    to: numeroDestino,
    body: mensaje,
  });
}