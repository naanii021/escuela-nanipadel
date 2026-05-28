// Cargamos las variables del archivo .env
require("dotenv").config();

// Leemos las claves privadas desde el .env
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const testTo = process.env.WHATSAPP_TEST_TO;

// Función principal para enviar el mensaje de prueba
async function enviarMensajePrueba() {
  try {
    // Comprobamos que no falte ningún dato importante
    if (!token || !phoneNumberId || !testTo) {
      console.error("❌ Faltan variables en el .env");
      console.error("Revisa estas 3:");
      console.error("- WHATSAPP_TOKEN");
      console.error("- WHATSAPP_PHONE_NUMBER_ID");
      console.error("- WHATSAPP_TEST_TO");
      return;
    }

    // URL de Meta para enviar mensajes por WhatsApp Cloud API
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    // Mensaje que vamos a mandar a tu móvil personal
    const body = {
      messaging_product: "whatsapp",
      to: testTo,
      type: "text",
      text: {
        body: "✅ Prueba desde el backend de NaniPadel. WhatsApp API funcionando.",
      },
    };

    // Enviamos la petición a Meta
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Leemos la respuesta de Meta
    const data = await response.json();

    // Si Meta devuelve error, lo mostramos bien en consola
    if (!response.ok) {
      console.error("❌ Error enviando WhatsApp:");
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    // Si todo sale bien, mostramos confirmación
    console.log("✅ WhatsApp enviado correctamente:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    // Capturamos errores inesperados de Node
    console.error("❌ Error inesperado:");
    console.error(error);
  }
}

// Ejecutamos la prueba
enviarMensajePrueba();