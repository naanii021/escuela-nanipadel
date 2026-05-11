import { db } from "../db/connection.js";

// Helper para ejecutar consultas con mysql2/promise
const query = (sql, params = []) => db.promise().query(sql, params);

// Tipos de eventos soportados por el sistema
export const NOTIFICATION_EVENTS = {
  RESERVA_CREADA: "reserva_creada",
  RESERVA_CANCELADA: "reserva_cancelada",
  CLASE_CANCELADA: "clase_cancelada",
  CLASE_REPROGRAMADA: "clase_reprogramada",
  AVISO_PROFESOR: "aviso_profesor",
  AVISO_CLUB: "aviso_club",
  TORNEO_EVENTO: "torneo_evento",
};

// Categoría de cada evento
export const EVENT_CATEGORY = {
  [NOTIFICATION_EVENTS.RESERVA_CREADA]: "reservas",
  [NOTIFICATION_EVENTS.RESERVA_CANCELADA]: "reservas",
  [NOTIFICATION_EVENTS.CLASE_CANCELADA]: "clases",
  [NOTIFICATION_EVENTS.CLASE_REPROGRAMADA]: "clases",
  [NOTIFICATION_EVENTS.AVISO_PROFESOR]: "clases",
  [NOTIFICATION_EVENTS.AVISO_CLUB]: "club",
  [NOTIFICATION_EVENTS.TORNEO_EVENTO]: "torneos",
};

// Preferencias por defecto
const DEFAULT_PREFERENCES = {
  email_enabled: 1,
  whatsapp_enabled: 0,
  in_app_enabled: 1,
  notify_reservas: 1,
  notify_clases: 1,
  notify_club: 1,
  notify_torneos: 1,
  whatsapp_phone: null,
};

// Convierte distintos tipos de valor a 0 o 1
function toDbBoolean(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

// Comprueba si una categoría concreta está activada en preferencias
function categoryEnabled(preferences, category) {
  const key = `notify_${category}`;
  return Number(preferences[key] ?? 1) === 1;
}

// Normaliza una fila de preferencias para no depender de nulls
function normalizePreferences(row = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...row,
    email_enabled: 1, // email obligatorio siempre
    whatsapp_enabled: toDbBoolean(
      row.whatsapp_enabled,
      DEFAULT_PREFERENCES.whatsapp_enabled
    ),
    in_app_enabled: toDbBoolean(
      row.in_app_enabled,
      DEFAULT_PREFERENCES.in_app_enabled
    ),
    notify_reservas: toDbBoolean(
      row.notify_reservas,
      DEFAULT_PREFERENCES.notify_reservas
    ),
    notify_clases: toDbBoolean(
      row.notify_clases,
      DEFAULT_PREFERENCES.notify_clases
    ),
    notify_club: toDbBoolean(
      row.notify_club,
      DEFAULT_PREFERENCES.notify_club
    ),
    notify_torneos: toDbBoolean(
      row.notify_torneos,
      DEFAULT_PREFERENCES.notify_torneos
    ),
    whatsapp_phone: row.whatsapp_phone || null,
  };
}

// Obtiene preferencias del usuario o las crea si no existen todavía
export async function getOrCreateNotificationPreferences(userId) {
  const [rows] = await query(
    "SELECT * FROM notification_preferences WHERE usuario_id = ? LIMIT 1",
    [userId]
  );

  if (rows[0]) return normalizePreferences(rows[0]);

  await query(
    `INSERT INTO notification_preferences
      (usuario_id, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos)
     VALUES (?, 1, 0, 1, 1, 1, 1, 1)`,
    [userId]
  );

  const [created] = await query(
    "SELECT * FROM notification_preferences WHERE usuario_id = ? LIMIT 1",
    [userId]
  );

  return normalizePreferences(created[0]);
}

// Actualiza preferencias del usuario
export async function updateNotificationPreferences(userId, payload) {
  const preferences = {
    email_enabled: 1, // siempre activo
    whatsapp_enabled: toDbBoolean(payload.whatsapp_enabled),
    in_app_enabled: toDbBoolean(payload.in_app_enabled, 1),
    notify_reservas: toDbBoolean(payload.notify_reservas, 1),
    notify_clases: toDbBoolean(payload.notify_clases, 1),
    notify_club: toDbBoolean(payload.notify_club, 1),
    notify_torneos: toDbBoolean(payload.notify_torneos, 1),
    whatsapp_phone: payload.whatsapp_phone
      ? String(payload.whatsapp_phone).trim()
      : null,
  };

  await query(
    `INSERT INTO notification_preferences
      (usuario_id, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos, whatsapp_phone)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      email_enabled = 1,
      whatsapp_enabled = VALUES(whatsapp_enabled),
      in_app_enabled = VALUES(in_app_enabled),
      notify_reservas = VALUES(notify_reservas),
      notify_clases = VALUES(notify_clases),
      notify_club = VALUES(notify_club),
      notify_torneos = VALUES(notify_torneos),
      whatsapp_phone = VALUES(whatsapp_phone)`,
    [
      userId,
      preferences.whatsapp_enabled,
      preferences.in_app_enabled,
      preferences.notify_reservas,
      preferences.notify_clases,
      preferences.notify_club,
      preferences.notify_torneos,
      preferences.whatsapp_phone,
    ]
  );

  return getOrCreateNotificationPreferences(userId);
}

// Resuelve usuarios destinatarios del evento
async function resolveRecipients(event) {
  const preferenceFields = `
    p.email_enabled,
    p.whatsapp_enabled,
    p.in_app_enabled,
    p.notify_reservas,
    p.notify_clases,
    p.notify_club,
    p.notify_torneos,
    p.whatsapp_phone
  `;

  // Caso 1: destinatarios concretos
  if (Array.isArray(event.recipientUserIds) && event.recipientUserIds.length) {
    const uniqueIds = [...new Set(event.recipientUserIds.map(Number).filter(Boolean))];

    if (!uniqueIds.length) return [];

    const [rows] = await query(
      `SELECT
         u.id,
         u.nombre,
         u.email,
         u.telefono,
         ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.usuario_id = u.id
       WHERE u.id IN (${uniqueIds.map(() => "?").join(", ")})`,
      uniqueIds
    );

    return rows;
  }

  // Caso 2: todos los usuarios activos
  if (event.audience === "all_users") {
    const [rows] = await query(
      `SELECT
         u.id,
         u.nombre,
         u.email,
         u.telefono,
         ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.usuario_id = u.id
       WHERE COALESCE(u.activo, 1) = 1`
    );

    return rows;
  }

  return [];
}

// Intenta sacar referencia tipo/id desde el evento
function getReferenceInfo(event) {
  const payload = event.payload || {};

  if (event.referenceType || event.referenceId) {
    return {
      referencia_tipo: event.referenceType || null,
      referencia_id: event.referenceId || null,
    };
  }

  if (payload.reserva_id) {
    return {
      referencia_tipo: "reserva",
      referencia_id: payload.reserva_id,
    };
  }

  if (payload.clase_id) {
    return {
      referencia_tipo: "clase",
      referencia_id: payload.clase_id,
    };
  }

  if (payload.torneo_id) {
    return {
      referencia_tipo: "torneo",
      referencia_id: payload.torneo_id,
    };
  }

  return {
    referencia_tipo: null,
    referencia_id: null,
  };
}

// Genera las filas a insertar en notifications según preferencias y canal
function buildChannelRows(user, preferences, event, category) {
  if (!categoryEnabled(preferences, category)) return [];

  const referenceInfo = getReferenceInfo(event);

  const base = {
    usuario_id: user.id,
    tipo: event.type,
    titulo: event.title,
    mensaje: event.body,
    referencia_tipo: referenceInfo.referencia_tipo,
    referencia_id: referenceInfo.referencia_id,
  };

  const rows = [];

  // Email obligatorio siempre
  rows.push({
    ...base,
    canal: "email",
    estado: user.email ? "pending" : "failed",
    error_message: user.email ? null : "El usuario no tiene email configurado.",
  });

  // WhatsApp opcional
  if (Number(preferences.whatsapp_enabled) === 1) {
    const phone = preferences.whatsapp_phone || user.telefono;

    rows.push({
      ...base,
      canal: "whatsapp",
      estado: phone ? "pending" : "failed",
      error_message: phone
        ? null
        : "WhatsApp activado sin telefono configurado.",
    });
  }

  // Notificación interna opcional
  if (Number(preferences.in_app_enabled) === 1) {
    rows.push({
      ...base,
      canal: "in_app",
      estado: "sent",
      error_message: null,
    });
  }

  return rows;
}

// Función central para crear notificaciones
export async function notifyEvent(event) {
  const category = event.category || EVENT_CATEGORY[event.type];

  if (!event.type || !category || !event.title || !event.body) {
    throw new Error("Evento de notificacion incompleto");
  }

  const recipients = await resolveRecipients(event);
  const created = [];

  for (const user of recipients) {
    const preferences = normalizePreferences(user);
    const channelRows = buildChannelRows(user, preferences, event, category);

    for (const row of channelRows) {
      const [result] = await query(
        `INSERT INTO notifications
          (usuario_id, tipo, canal, titulo, mensaje, referencia_tipo, referencia_id, estado, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? IN ('sent'), NOW(), NULL))`,
        [
          row.usuario_id,
          row.tipo,
          row.canal,
          row.titulo,
          row.mensaje,
          row.referencia_tipo,
          row.referencia_id,
          row.estado,
          row.error_message,
          row.estado,
        ]
      );

      created.push({
        id: result.insertId,
        canal: row.canal,
        estado: row.estado,
      });
    }
  }

  return {
    recipients: recipients.length,
    notifications: created,
  };
}