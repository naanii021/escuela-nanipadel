import { db } from "../db/connection.js";

const query = (sql, params = []) => db.promise().query(sql, params);
let preferenceUserColumnCache = null;

export const NOTIFICATION_EVENTS = {
  RESERVA_CREADA: "reserva_creada",
  RESERVA_CANCELADA: "reserva_cancelada",
  CLASE_CANCELADA: "clase_cancelada",
  CLASE_REPROGRAMADA: "clase_reprogramada",
  AVISO_PROFESOR: "aviso_profesor",
  AVISO_CLUB: "aviso_club",
  TORNEO_EVENTO: "torneo_evento",
};

const EVENT_CATEGORY = {
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

function categoryIsEnabled(preferences, category) {
  return Number(preferences[`notify_${category}`] ?? 1) === 1;
}

async function getPreferenceUserColumn() {
  if (preferenceUserColumnCache) return preferenceUserColumnCache;

  const [columns] = await query("SHOW COLUMNS FROM notification_preferences");
  const names = new Set(columns.map((column) => column.Field));
  preferenceUserColumnCache = names.has("usuario_id") ? "usuario_id" : "user_id";
  return preferenceUserColumnCache;
}

export async function getOrCreateNotificationPreferences(userId) {
  const userColumn = await getPreferenceUserColumn();
  const [rows] = await query(
    `SELECT * FROM notification_preferences WHERE ${userColumn} = ? LIMIT 1`,
    [userId]
  );

  if (rows[0]) return normalizePreferences(rows[0]);

  await query(
    `INSERT INTO notification_preferences
      (${userColumn}, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos)
     VALUES (?, 1, 0, 0, 1, 1, 1, 1)`,
    [userId]
  );

  const [created] = await query(
    `SELECT * FROM notification_preferences WHERE ${userColumn} = ? LIMIT 1`,
    [userId]
  );

  return normalizePreferences(created[0]);
}

export async function updateNotificationPreferences(userId, payload = {}) {
  const userColumn = await getPreferenceUserColumn();
  await query(
    `INSERT INTO notification_preferences
      (${userColumn}, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos, whatsapp_phone)
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
      toDbBoolean(payload.whatsapp_enabled),
      toDbBoolean(payload.in_app_enabled),
      toDbBoolean(payload.notify_reservas, 1),
      toDbBoolean(payload.notify_clases, 1),
      toDbBoolean(payload.notify_club, 1),
      toDbBoolean(payload.notify_torneos, 1),
      payload.whatsapp_phone ? String(payload.whatsapp_phone).trim() : null,
    ]
  );

  return getOrCreateNotificationPreferences(userId);
}

async function resolveRecipients(event) {
  const preferenceUserColumn = await getPreferenceUserColumn();

  if (Array.isArray(event.recipientUserIds) && event.recipientUserIds.length) {
    const userIds = [...new Set(event.recipientUserIds.map(Number).filter(Boolean))];
    const [rows] = await query(
      `SELECT
        u.id,
        u.email,
        u.telefono,
        p.email_enabled,
        p.whatsapp_enabled,
        p.in_app_enabled,
        p.notify_reservas,
        p.notify_clases,
        p.notify_club,
        p.notify_torneos,
       p.whatsapp_phone
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.${preferenceUserColumn} = u.id
       WHERE u.id IN (${userIds.map(() => "?").join(", ")})`,
      userIds
    );
    return rows;
  }

  if (event.audience === "all_users") {
    const [rows] = await query(
      `SELECT
        u.id,
        u.email,
        u.telefono,
        p.email_enabled,
        p.whatsapp_enabled,
        p.in_app_enabled,
        p.notify_reservas,
        p.notify_clases,
        p.notify_club,
        p.notify_torneos,
       p.whatsapp_phone
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.${preferenceUserColumn} = u.id
       WHERE COALESCE(u.activo, 1) = 1`
    );
    return rows;
  }

  return [];
}

function buildChannels(user, preferences, category) {
  if (!categoryIsEnabled(preferences, category)) return [];

  const channels = ["email"];

  if (Number(preferences.whatsapp_enabled) === 1 && (preferences.whatsapp_phone || user.telefono)) {
    channels.push("whatsapp");
  }

  if (Number(preferences.in_app_enabled) === 1) {
    channels.push("in_app");
  }

  return channels;
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
    const channels = buildChannels(user, preferences, category);

    for (const canal of channels) {
      const estado = canal === "in_app" ? "unread" : "pending";
      const [result] = await query(
        `INSERT INTO notifications
          (usuario_id, tipo, canal, titulo, mensaje, estado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.id, event.type, canal, event.title, event.body, estado]
      );

      created.push({ id: result.insertId, canal, estado });
    }
  }

  return { recipients: recipients.length, notifications: created };
}
