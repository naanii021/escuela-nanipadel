// Cargamos las variables del archivo .env
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Obtenemos la ruta real de este archivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargamos el .env que está en la carpeta backend
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Importamos el servicio real de notificaciones
const { notifyEvent, NOTIFICATION_EVENTS } = await import (
    "../services/notificationService.js"
);

// Usuario de prueba.
// En tu captura, el usuario 1 tiene WhatsApp activado.
const userId = 1;

try {
  // Lanzamos una notificación real de prueba
  const result = await notifyEvent({
    type: NOTIFICATION_EVENTS.AVISO_CLUB,
    title: "Prueba de notificaciones NaniPadel",
    body: "✅ Si recibes este WhatsApp, notificationsService ya está conectado con Meta Cloud API.",
    recipientUserIds: [userId],
    payload: {
      prueba: true,
    },
  });

  // Mostramos el resultado en consola
  console.log("✅ Notificación procesada correctamente:");
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
} catch (error) {
  // Mostramos cualquier error que aparezca
  console.error("❌ Error probando notificationsService:");
  console.error(error);

  process.exit(1);
}