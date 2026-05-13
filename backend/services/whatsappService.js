import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

// Creamos el cliente de Twilio con las credenciales del .env
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Función para enviar un WhatsApp
export async function sendWhatsAppMessage({ to, body }) {
  // Validación básica
  if (!to) {
    throw new Error("Falta el número de destino");
  }

  if (!body) {
    throw new Error("Falta el contenido del mensaje");
  }

  // Si el número no lleva el prefijo whatsapp:, se lo añadimos
  const formattedTo = String(to).startsWith("whatsapp:")
    ? String(to)
    : `whatsapp:${to}`;

  // Enviamos el mensaje usando Twilio
  const message = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: formattedTo,
    body,
  });

  return message;
}