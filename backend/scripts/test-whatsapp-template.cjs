const path = require("path");
const { pathToFileURL } = require("url");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEFAULT_RESERVA_CONFIRMADA_VARIABLES = [
  "Daniel",
  "Pista 1",
  "martes 4 de junio",
  "19:30",
];

function parseVariables(value, templateName) {
  if (typeof value === "string" && value.length > 0) {
    return value.split("|");
  }

  if (templateName === "reserva_confirmada") {
    return DEFAULT_RESERVA_CONFIRMADA_VARIABLES;
  }

  return [];
}

function cleanErrorMessage(error) {
  const message = error?.message || "Error desconocido";
  const secrets = [
    process.env.WHATSAPP_TOKEN,
    process.env.WHATSAPP_VERIFY_TOKEN,
    process.env.META_ACCESS_TOKEN,
  ].filter(Boolean);

  return secrets.reduce(
    (cleanMessage, secret) => cleanMessage.replaceAll(secret, "[redacted]"),
    message
  );
}

async function main() {
  const to = process.env.WHATSAPP_TEST_TO;
  const templateName = process.env.WHATSAPP_TEST_TEMPLATE || "reserva_confirmada";
  const languageCode = process.env.WHATSAPP_TEST_LANGUAGE || "es";
  const variables = parseVariables(
    process.env.WHATSAPP_TEST_VARIABLES,
    templateName
  );

  if (!to) {
    throw new Error("Falta WHATSAPP_TEST_TO en el entorno para enviar la prueba.");
  }

  console.log("Probando plantilla de WhatsApp:", {
    templateName,
    languageCode,
    variables,
    totalVariables: variables.length,
  });

  const serviceUrl = pathToFileURL(
    path.join(__dirname, "..", "services", "whatsappService.js")
  ).href;
  const { sendWhatsAppTemplate } = await import(serviceUrl);

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    variables,
  });

  console.log("Plantilla enviada correctamente:", {
    templateName,
    languageCode,
    variables,
    totalVariables: variables.length,
    provider_message_id: result.provider_message_id || result.messageId,
  });
}

main().catch((error) => {
  console.error("Error enviando plantilla de WhatsApp:", {
    status: error?.status || error?.statusCode || "desconocido",
    message: cleanErrorMessage(error),
  });
  console.error(
    'Si Meta indica error de idioma, prueba con WHATSAPP_TEST_LANGUAGE="es_ES".'
  );
  process.exitCode = 1;
});
