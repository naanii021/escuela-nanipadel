import dotenv from "dotenv";

dotenv.config();

const META_API_VERSION = process.env.META_WHATSAPP_API_VERSION || "v25.0";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

// Normaliza teléfonos a formato internacional sin espacios ni símbolos raros.
// Meta espera el destinatario sin "whatsapp:" y normalmente en formato E.164 sin el "+" en el campo "to".
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  let normalized = String(phone).trim();

  normalized = normalized.replace(/^whatsapp:/i, "");
  normalized = normalized.replace(/\s+/g, "");
  normalized = normalized.replace(/[()-]/g, "");

  if (!normalized.startsWith("+")) {
    normalized = `+${normalized}`;
  }

  return normalized;
}

// Meta suele aceptar el número sin el símbolo "+" en el campo "to".
function toMetaRecipient(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  return normalized.replace(/^\+/, "");
}

// Envía mensaje de texto libre.
// Esto te vale para pruebas y para mensajes dentro de la ventana de servicio.
// Fuera de esa ventana tendrás que usar plantillas. :contentReference[oaicite:1]{index=1}
export async function sendWhatsAppMessage({ to, body }) {
  if (!META_TOKEN) {
    throw new Error("Falta META_WHATSAPP_TOKEN en el .env");
  }

  if (!META_PHONE_NUMBER_ID) {
    throw new Error("Falta META_WHATSAPP_PHONE_NUMBER_ID en el .env");
  }

  if (!to) {
    throw new Error("Falta el número de destino");
  }

  if (!body) {
    throw new Error("Falta el contenido del mensaje");
  }

  const recipient = toMetaRecipient(to);

  if (!recipient) {
    throw new Error("Número de destino no válido");
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
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

  const data = await response.json();

  if (!response.ok) {
    const metaError =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      "Error desconocido al enviar WhatsApp con Meta";

    throw new Error(metaError);
  }

  return {
    ok: true,
    provider: "meta",
    messageId: data?.messages?.[0]?.id || null,
    raw: data,
  };
}