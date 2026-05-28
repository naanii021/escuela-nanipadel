import { db } from "../db/connection.js";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "./whatsappService.js";

const query = (sql, params = []) => db.promise().query(sql, params);

export const NOTIFICATION_EVENTS = {
  RESERVA_CREADA: "reserva_creada",
  RESERVA_CANCELADA: "reserva_cancelada",
  PARTIDA_ABIERTA_UNIDO: "partida_abierta_unido",
  PARTIDA_ABIERTA_SALIDA:"partida_abierta_salida",
  PARTIDA_ABIERTA_COMPLETA:"partida_abierta_completa",
  CLASE_CANCELADA: "clase_cancelada",
  CLASE_REPROGRAMADA: "clase_reprogramada",
  AVISO_PROFESOR: "aviso_profesor",
  AVISO_CLUB: "aviso_club",
  TORNEO_EVENTO: "torneo_evento",
};

export const EVENT_CATEGORY = {
  [NOTIFICATION_EVENTS.RESERVA_CREADA]: "reservas",
  [NOTIFICATION_EVENTS.RESERVA_CANCELADA]: "reservas",
  [NOTIFICATION_EVENTS.PARTIDA_ABIERTA_UNIDO]: "reservas",
  [NOTIFICATION_EVENTS.PARTIDA_ABIERTA_SALIDA]: "reservas",
  [NOTIFICATION_EVENTS.PARTIDA_ABIERTA_COMPLETA]: "reservas",
  [NOTIFICATION_EVENTS.CLASE_CANCELADA]: "clases",
  [NOTIFICATION_EVENTS.CLASE_REPROGRAMADA]: "clases",
  [NOTIFICATION_EVENTS.AVISO_PROFESOR]: "clases",
  [NOTIFICATION_EVENTS.AVISO_CLUB]: "club",
  [NOTIFICATION_EVENTS.TORNEO_EVENTO]: "torneos",
};

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

function toDbBoolean(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

function categoryEnabled(preferences, category) {
  return Number(preferences[`notify_${category}`] ?? 1) === 1;
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
    whatsapp_phone: row.whatsapp_phone || null,
  };
}

export async function getOrCreateNotificationPreferences(userId) {
  const [rows] = await query(
    "SELECT * FROM notification_preferences WHERE usuario_id = ? LIMIT 1",
    [userId]
  );

  if (rows[0]) return normalizePreferences(rows[0]);

  await query(
    `INSERT INTO notification_preferences
      (usuario_id, email_enabled, whatsapp_enabled, in_app_enabled, notify_reservas, notify_clases, notify_club, notify_torneos, whatsapp_phone)
     VALUES (?, 1, 0, 1, 1, 1, 1, 1, NULL)`,
    [userId]
  );

  const [created] = await query(
    "SELECT * FROM notification_preferences WHERE usuario_id = ? LIMIT 1",
    [userId]
  );

  return normalizePreferences(created[0]);
}

export async function updateNotificationPreferences(userId, payload = {}) {
  // Recuperamos preferencias actuales para no machacar valores si no vienen en el payload
  const current = await getOrCreateNotificationPreferences(userId);

  // Función auxiliar para saber si un campo viene realmente en el body
  const hasField = (field) =>
    Object.prototype.hasOwnProperty.call(payload, field);

  // Construimos preferencias nuevas conservando las anteriores cuando no se envía un campo
  const preferences = {
    whatsapp_enabled: hasField("whatsapp_enabled")
      ? toDbBoolean(payload.whatsapp_enabled, current.whatsapp_enabled)
      : current.whatsapp_enabled,

    in_app_enabled: hasField("in_app_enabled")
      ? toDbBoolean(payload.in_app_enabled, current.in_app_enabled)
      : current.in_app_enabled,

    notify_reservas: hasField("notify_reservas")
      ? toDbBoolean(payload.notify_reservas, current.notify_reservas)
      : current.notify_reservas,

    notify_clases: hasField("notify_clases")
      ? toDbBoolean(payload.notify_clases, current.notify_clases)
      : current.notify_clases,

    notify_club: hasField("notify_club")
      ? toDbBoolean(payload.notify_club, current.notify_club)
      : current.notify_club,

    notify_torneos: hasField("notify_torneos")
      ? toDbBoolean(payload.notify_torneos, current.notify_torneos)
      : current.notify_torneos,

    whatsapp_phone: hasField("whatsapp_phone")
      ? payload.whatsapp_phone
        ? String(payload.whatsapp_phone).trim()
        : null
      : current.whatsapp_phone,
  };

  // Guardamos o actualizamos las preferencias del usuario
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
    if (!uniqueIds.length) return [];

    const [rows] = await query(
      `SELECT
        u.id,
        u.nombre,
        u.email,
        ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.usuario_id = u.id
       WHERE u.id IN (${uniqueIds.map(() => "?").join(", ")})`,
      uniqueIds
    );

    return rows;
  }

  if (event.audience === "all_users") {
    const [rows] = await query(
      `SELECT
        u.id,
        u.nombre,
        u.email,
        ${preferenceFields}
       FROM usuarios u
       LEFT JOIN notification_preferences p ON p.usuario_id = u.id
       WHERE COALESCE(u.activo, 1) = 1`
    );

    return rows;
  }

  return [];
}

function getReferenceInfo(event) {
  const payload = event.payload || {};

  if (event.referenceType || event.referenceId) {
    return {
      referencia_tipo: event.referenceType || null,
      referencia_id: event.referenceId || null,
    };
  }

  if (payload.reserva_id) return { referencia_tipo: "reserva", referencia_id: payload.reserva_id };
  if (payload.clase_id) return { referencia_tipo: "clase", referencia_id: payload.clase_id };
  if (payload.torneo_id) return { referencia_tipo: "torneo", referencia_id: payload.torneo_id };

  return { referencia_tipo: null, referencia_id: null };
}

function buildChannelRows(user, preferences, event, category) {
  if (!categoryEnabled(preferences, category)) return [];

  const allowedChannels = Array.isArray(event.channels) && event.channels.length
    ? new Set(event.channels)
    : null;
  const channelEnabled = (channel) => !allowedChannels || allowedChannels.has(channel);
  const referenceInfo = getReferenceInfo(event);
  const base = {
    usuario_id: user.id,
    usuario_nombre: user.nombre || null,
    tipo: event.type,
    titulo: event.title,
    mensaje: event.body,
    referencia_tipo: referenceInfo.referencia_tipo,
    referencia_id: referenceInfo.referencia_id,
  };

  const rows = [];

  if (channelEnabled("email")) {
    rows.push({
      ...base,
      canal: "email",
      estado: user.email ? "pending" : "failed",
      error_message: user.email ? null : "El usuario no tiene email configurado.",
    });
  }

  if (channelEnabled("in_app") && Number(preferences.in_app_enabled) === 1) {
    rows.push({
      ...base,
      canal: "in_app",
      estado: "sent",
      error_message: null,
    });
  }

  if (channelEnabled("whatsapp") && Number(preferences.whatsapp_enabled) === 1) {
    rows.push({
      ...base,
      canal: "whatsapp",
      estado: preferences.whatsapp_phone ? "pending" : "failed",
      error_message: preferences.whatsapp_phone
        ? null
        : "WhatsApp activado sin telefono configurado.",
      whatsapp_phone: preferences.whatsapp_phone,
    });
  }

  return rows;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function buildReservationTemplateFields(payload = {}) {
  // Sacamos la pista desde distintos nombres posibles
  const pista = firstValue(
    payload.pista_nombre,
    payload.nombre_pista,
    payload.pista,
    payload.court_name,
    payload.court,
    payload.nombrePista,
    "NaniPadel"
  );

  // Sacamos la fecha desde distintos nombres posibles
  const fecha = firstValue(
    payload.fecha_texto,
    payload.fecha_reserva_texto,
    payload.fechaReservaTexto,
    payload.fecha,
    payload.fecha_reserva,
    payload.reserva_fecha,
    payload.dia,
    payload.date,
    "la fecha indicada"
  );

  // Sacamos la hora desde distintos nombres posibles
  const hora = firstValue(
    payload.hora_texto,
    payload.hora_inicio_texto,
    payload.horaInicioTexto,
    payload.hora_inicio,
    payload.hora,
    payload.inicio,
    payload.time,
    "la hora indicada"
  );

  return {
    pista: String(pista),
    fecha: String(fecha),
    hora: String(hora),
  };
}

function buildReservationSummary(payload = {}, row = {}) {
  const { pista, fecha, hora } = buildReservationTemplateFields(payload);

  return firstValue(
    [pista, fecha, hora && `a las ${hora}`].filter(Boolean).join(" ").trim(),
    row.mensaje,
    row.titulo,
    "tu reserva en NaniPadel"
  );
}

function buildWhatsAppTemplateData(row, payload = {}) {
  const nombreUsuario = firstValue(
    payload.usuario_nombre,
    payload.nombre_usuario,
    payload.nombre,
    row.usuario_nombre,
    "jugador"
  );

  const { pista, fecha, hora } = buildReservationTemplateFields(payload);

  if (row.tipo === NOTIFICATION_EVENTS.RESERVA_CREADA) {
    return {
      templateName: WHATSAPP_TEMPLATES.RESERVA_CONFIRMADA,
      languageCode: "es",

      // Plantilla reserva_confirmada:
      // Hola {{1}}, tu reserva en {{2}} ha quedado confirmada para el {{3}} a las {{4}}.
      variables: [
        nombreUsuario,
        pista,
        fecha,
        hora,
      ],
    };
  }

  if (row.tipo === NOTIFICATION_EVENTS.RESERVA_CANCELADA) {
    return {
      templateName: WHATSAPP_TEMPLATES.RESERVA_CANCELADA,
      languageCode: "es",

      // Ojo: esto asume que reserva_cancelada también tiene 4 variables:
      // {{1}} nombre, {{2}} pista, {{3}} fecha, {{4}} hora.
      variables: [
        nombreUsuario,
        pista,
        fecha,
        hora,
      ],
    };
  }

  return null;
}

function buildWhatsAppTemplateForEvent(event, row) {
  const payload = event.payload || {};
  return buildWhatsAppTemplateData(row, payload);
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
          (usuario_id, tipo, canal, titulo, mensaje, referencia_tipo, referencia_id, estado, error_message, sent_at, payload, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? IN ('sent'), NOW(), NULL), ?, ?)`,
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
          event.payload ? JSON.stringify(event.payload) : null,
          event.createdByUserId || null,
        ]
      );

      if (row.canal === "whatsapp") {
        if (row.estado === "failed") {
          created.push({
            id: result.insertId,
            canal: row.canal,
            estado: row.estado,
          });
          continue;
        }

        try {
          const templatePayload = buildWhatsAppTemplateForEvent(event, row);
          const whatsappResult = templatePayload
            ? await sendWhatsAppTemplate({
                to: row.whatsapp_phone,
                templateName: templatePayload.templateName,
                languageCode: templatePayload.languageCode,
                variables: templatePayload.variables,
              })
            : await sendWhatsAppMessage({
                to: row.whatsapp_phone,
                body: `${row.titulo}\n\n${row.mensaje}`,
              });

          await query(
            `UPDATE notifications
             SET estado = 'sent', sent_at = NOW(), error_message = NULL, provider_message_id = ?
             WHERE id = ?`,
            [whatsappResult.provider_message_id || whatsappResult.messageId, result.insertId]
          );

          created.push({
            id: result.insertId,
            canal: row.canal,
            estado: "sent",
          });
        } catch (error) {
          console.error("Error enviando WhatsApp desde notificationService:", {
            notificationId: result.insertId,
            tipo: row.tipo,
            message: error.message,
          });

          await query(
            `UPDATE notifications
             SET estado = 'failed', error_message = ?
             WHERE id = ?`,
            [error.message, result.insertId]
          );

          created.push({
            id: result.insertId,
            canal: row.canal,
            estado: "failed",
          });
        }

        continue;
      }

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
