import { db } from "../db/connection.js";

const query = (sql, params = []) => db.promise().query(sql, params);

export const NOTIFICATION_EVENTS = {
  RESERVA_CREADA: "reserva_creada",
  RESERVA_CANCELADA: "reserva_cancelada",
  CLASE_CANCELADA: "clase_cancelada",
  CLASE_REPROGRAMADA: "clase_reprogramada",
  AVISO_PROFESOR: "aviso_profesor",
  AVISO_CLUB: "aviso_club",
  TORNEO_EVENTO: "torneo_evento",
};

export const EVENT_CATEGORY = {
  [NOTIFICATION_EVENTS.RESERVA_CREADA]: "reservas",
  [NOTIFICATION_EVENTS.RESERVA_CANCELADA]: "reservas",
  [NOTIFICATION_EVENTS.CLASE_CANCELADA]: "clases",
  [NOTIFICATION_EVENTS.CLASE_REPROGRAMADA]: "clases",
  [NOTIFICATION_EVENTS.AVISO_PROFESOR]: "clases",
  [NOTIFICATION_EVENTS.AVISO_CLUB]: "club",
  [NOTIFICATION_EVENTS.TORNEO_EVENTO]: "torneos",
};

const DEFAULT_PREFERENCES = {
  email_enabled: 1,
  whatsapp_enabled: 0,
  in_app_enabled: 0,
  notify_reservas: 1,
  notify_clases: 1,
  notify_club: 1,
  notify_torneos: 1,
  whatsapp_phone: null,
};

function toDbBoolean(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

function categoryEnabled(preferences, category) {
  const key = `notify_${category}`;
  return Number(preferences[key] ?? 1) === 1;
}

function normalizePreferences(row = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...row,
    email_enabled: 1,
    whatsapp_enabled: toDbBoolean(row.whatsapp_enabled, DEFAULT_PREFERENCES.whatsapp_enabled),
    in_app_enabled: toDbBoolean(row.in_app_enabled, DEFAULT_PREFERENCES.in_app_enabled),
    notify_reservas: toDbBoolean(row.notify_reservas, DEFAULT_PREFERENCES.notify_reservas),
    notify_clases: toDbBoolean(row.notify_clases, DEFAULT_PREFERENCES.notify_clases),
    notify_club: toDbBoolean(row.notify_club, DEFAULT_PREFERENCES.notify_club),
    notify_torneos: toDbBoolean(row.notify_torneos, DEFAULT_PREFERENCES.notify_torneos),
  };
}

export async function getOrCreateNotificationPreferences(userId) {
  const [rows] = await query(
    "SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1",
    [userId]
  );

  if (rows[0]) return normalizePreferences(rows[0]);

  await query(
    `INSERT INTO notification_preferences
      (user_id, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos)
     VALUES (?, 1, 0, 0, 1, 1, 1, 1)`,
    [userId]
  );

  const [created] = await query(
    "SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return normalizePreferences(created[0]);
}

export async function updateNotificationPreferences(userId, payload) {
  const preferences = {
    email_enabled: 1,
    whatsapp_enabled: toDbBoolean(payload.whatsapp_enabled),
    in_app_enabled: toDbBoolean(payload.in_app_enabled),
    notify_reservas: toDbBoolean(payload.notify_reservas, 1),
    notify_clases: toDbBoolean(payload.notify_clases, 1),
    notify_club: toDbBoolean(payload.notify_club, 1),
    notify_torneos: toDbBoolean(payload.notify_torneos, 1),
    whatsapp_phone: payload.whatsapp_phone ? String(payload.whatsapp_phone).trim() : null,
  };

  await query(
    `INSERT INTO notification_preferences
      (user_id, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos, whatsapp_phone)
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

  if (Array.isArray(event.recipientUserIds) && event.recipientUserIds.length) {
    const uniqueIds = [...new Set(event.recipientUserIds.map(Number).filter(Boolean))];
    const [rows] = await query(
      `SELECT u.id, u.nombre, u.email, u.telefono, ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.user_id = u.id
       WHERE u.id IN (${uniqueIds.map(() => "?").join(", ")})`,
      uniqueIds
    );
    return rows;
  }

  if (event.audience === "all_users") {
    const [rows] = await query(
      `SELECT u.id, u.nombre, u.email, u.telefono, ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.user_id = u.id
       WHERE COALESCE(u.activo, 1) = 1`
    );
    return rows;
  }

  return [];
}

function buildChannelRows(user, preferences, event, category) {
  if (!categoryEnabled(preferences, category)) return [];

  const base = {
    user_id: user.id,
    event_type: event.type,
    category,
    title: event.title,
    body: event.body,
    payload: JSON.stringify(event.payload || {}),
    created_by_user_id: event.createdByUserId || null,
  };

  const rows = [
    {
      ...base,
      channel: "email",
      status: user.email ? "pending" : "failed",
      error_message: user.email ? null : "El usuario no tiene email configurado.",
    },
  ];

  if (Number(preferences.whatsapp_enabled) === 1) {
    const phone = preferences.whatsapp_phone || user.telefono;
    rows.push({
      ...base,
      channel: "whatsapp",
      status: phone ? "pending" : "failed",
      error_message: phone ? null : "WhatsApp activado sin telefono configurado.",
    });
  }

  if (Number(preferences.in_app_enabled) === 1) {
    rows.push({ ...base, channel: "in_app", status: "delivered", error_message: null });
  }

  return rows;
}

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
          (user_id, event_type, category, channel, title, body, status, error_message, payload, created_by_user_id, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? IN ('sent','delivered'), NOW(), NULL))`,
        [
          row.user_id,
          row.event_type,
          row.category,
          row.channel,
          row.title,
          row.body,
          row.status,
          row.error_message,
          row.payload,
          row.created_by_user_id,
          row.status,
        ]
      );
      created.push({ id: result.insertId, channel: row.channel, status: row.status });
    }
  }

  return { recipients: recipients.length, notifications: created };
}
