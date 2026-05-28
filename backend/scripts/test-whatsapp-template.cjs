const path = require("path");
const { pathToFileURL } = require("url");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const to = process.env.WHATSAPP_TEST_TO;
  const templateName = process.env.WHATSAPP_TEST_TEMPLATE || "reserva_confirmada";
  const languageCode = process.env.WHATSAPP_TEST_LANGUAGE || "es";

  if (!to) {
    throw new Error("Falta WHATSAPP_TEST_TO en el entorno para enviar la prueba.");
  }

  const serviceUrl = pathToFileURL(
    path.join(__dirname, "..", "services", "whatsappService.js")
  ).href;
  const { sendWhatsAppTemplate } = await import(serviceUrl);

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    variables: ["Dani", "Pista 2", "lunes, 25 de Mayo", "18:30h"],
  });

  console.log("Plantilla enviada correctamente:", {
    templateName,
    languageCode,
    provider_message_id: result.provider_message_id || result.messageId,
  });
}

main().catch((error) => {
  console.error("Error enviando plantilla de WhatsApp:", error.message);
  console.error(
    'Si Meta indica error de idioma, prueba con WHATSAPP_TEST_LANGUAGE="es_ES".'
  );
  process.exitCode = 1;
});
