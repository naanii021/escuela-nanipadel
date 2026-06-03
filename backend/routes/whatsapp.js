import express from "express";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { sendTextMessage } from "../services/whatsappService.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);
const ADMIN_ONLY = [requireAuth, requireRoles(["admin"])];

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function inboxReady() {
  return (await tableExists("whatsapp_conversations")) && (await tableExists("whatsapp_messages"));
}

function mysqlDateFromTimestamp(timestamp) {
  const seconds = Number(timestamp);
  const date = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function mysqlDateFromDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addHours(mysqlDate, hours) {
  const date = new Date(`${mysqlDate.replace(" ", "T")}Z`);
  date.setHours(date.getHours() + hours);
  return mysqlDateFromDate(date);
}

function canReplyUntil(windowUntil) {
  if (!windowUntil) return false;
  return new Date(windowUntil).getTime() >= Date.now();
}

function normalizeConversationStatus(status) {
  return ["pendiente", "abierta", "atendida", "cerrada"].includes(status) ? status : "abierta";
}

function normalizeMessageStatus(status) {
  const map = {
    sent: "enviado",
    delivered: "entregado",
    read: "leido",
    failed: "error",
  };
  return map[status] || null;
}

function messageType(message) {
  if (message?.type === "text") return "text";
  if (["image", "audio", "document"].includes(message?.type)) return message.type;
  return "unknown";
}

function messageContent(message) {
  if (message?.type === "text") return message.text?.body || "";
  if (message?.type === "image") return message.image?.caption || "Imagen recibida";
  if (message?.type === "audio") return "Audio recibido";
  if (message?.type === "document") return message.document?.filename || "Documento recibido";
  return "Mensaje recibido";
}

async function getConversationById(id) {
  const [rows] = await query("SELECT * FROM whatsapp_conversations WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function upsertInboundConversation({ waId, phone, name, content, messageAt }) {
  const windowUntil = addHours(messageAt, 24);
  await query(
    `INSERT INTO whatsapp_conversations
      (wa_id, telefono, nombre_contacto, estado, ultimo_mensaje, ultimo_mensaje_en, ultimo_mensaje_cliente_en, ventana_24h_hasta)
     VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      telefono = VALUES(telefono),
      nombre_contacto = COALESCE(VALUES(nombre_contacto), nombre_contacto),
      estado = IF(estado = 'cerrada', 'abierta', estado),
      ultimo_mensaje = VALUES(ultimo_mensaje),
      ultimo_mensaje_en = VALUES(ultimo_mensaje_en),
      ultimo_mensaje_cliente_en = VALUES(ultimo_mensaje_cliente_en),
      ventana_24h_hasta = VALUES(ventana_24h_hasta)`,
    [waId, phone, name || null, content, messageAt, messageAt, windowUntil]
  );

  const [rows] = await query("SELECT * FROM whatsapp_conversations WHERE wa_id = ? LIMIT 1", [waId]);
  return rows[0];
}

async function saveInboundMessage(conversation, message, value) {
  const type = messageType(message);
  const content = messageContent(message);
  const createdAt = mysqlDateFromTimestamp(message.timestamp);

  await query(
    `INSERT INTO whatsapp_messages
      (conversation_id, meta_message_id, direccion, tipo, contenido, estado, raw_payload, created_at)
     VALUES (?, ?, 'inbound', ?, ?, 'recibido', ?, ?)`,
    [
      conversation.id,
      message.id || null,
      type,
      content,
      JSON.stringify({ message, metadata: value?.metadata || null }),
      createdAt,
    ]
  );
}

async function processStatus(status) {
  const nextStatus = normalizeMessageStatus(status.status);
  if (!nextStatus || !status.id) return;

  await query(
    `UPDATE whatsapp_messages
     SET estado = ?, error_message = ?
     WHERE meta_message_id = ?`,
    [nextStatus, status.errors?.[0]?.message || null, status.id]
  );
}

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expected) {
    return res.status(500).send("WhatsApp webhook verify token is not configured");
  }

  if (mode === "subscribe" && token === expected) {
    return res.status(200).send(challenge || "");
  }

  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    if (!(await inboxReady())) {
      console.warn("WhatsApp inbox SQL is not active. Incoming webhook ignored.");
      return res.sendStatus(200);
    }

    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const contacts = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));

        for (const status of value.statuses || []) {
          await processStatus(status);
        }

        for (const message of value.messages || []) {
          const waId = message.from;
          if (!waId) continue;

          const contact = contacts.get(waId);
          const content = messageContent(message);
          const messageAt = mysqlDateFromTimestamp(message.timestamp);
          const conversation = await upsertInboundConversation({
            waId,
            phone: waId,
            name: contact?.profile?.name || null,
            content,
            messageAt,
          });

          await saveInboundMessage(conversation, message, value);
        }
      }
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("Error procesando webhook de WhatsApp:", e.message);
    return res.sendStatus(200);
  }
});

router.get("/conversations", ...ADMIN_ONLY, async (req, res) => {
  try {
    if (!(await inboxReady())) {
      return res.status(503).json({ ok: false, message: "Falta activar la bandeja de WhatsApp en la base de datos." });
    }

    const where = [];
    const params = [];
    const estado = String(req.query.estado || "").toLowerCase();
    const search = String(req.query.q || req.query.search || "").trim();

    if (["pendiente", "abierta", "atendida", "cerrada"].includes(estado)) {
      where.push("c.estado = ?");
      params.push(estado);
    }

    if (search) {
      where.push("(c.nombre_contacto LIKE ? OR c.telefono LIKE ? OR c.wa_id LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await query(
      `SELECT
        c.id,
        c.wa_id,
        c.telefono,
        c.nombre_contacto,
        c.estado,
        c.ultimo_mensaje,
        c.ultimo_mensaje_en,
        c.ultimo_mensaje_cliente_en,
        c.ventana_24h_hasta,
        SUM(CASE WHEN m.direccion = 'inbound' AND m.estado = 'recibido' THEN 1 ELSE 0 END) AS unread_count
       FROM whatsapp_conversations c
       LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY c.id
       ORDER BY c.ultimo_mensaje_en DESC, c.updated_at DESC`,
      params
    );

    res.json({
      ok: true,
      conversations: rows.map((row) => ({
        ...row,
        unread_count: Number(row.unread_count || 0),
        puede_responder_libre: canReplyUntil(row.ventana_24h_hasta),
      })),
    });
  } catch (e) {
    console.error("Error GET /api/whatsapp/conversations:", e.message);
    res.status(500).json({ ok: false, message: "No se pudieron cargar los mensajes." });
  }
});

router.get("/conversations/:id/messages", ...ADMIN_ONLY, async (req, res) => {
  try {
    if (!(await inboxReady())) {
      return res.status(503).json({ ok: false, message: "Falta activar la bandeja de WhatsApp en la base de datos." });
    }

    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ ok: false, message: "Conversación no encontrada." });

    const [rows] = await query(
      `SELECT id, meta_message_id, direccion, tipo, contenido, estado, error_message, created_at
       FROM whatsapp_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
      [conversation.id]
    );

    res.json({
      ok: true,
      conversation: {
        ...conversation,
        puede_responder_libre: canReplyUntil(conversation.ventana_24h_hasta),
      },
      messages: rows,
    });
  } catch (e) {
    console.error("Error GET /api/whatsapp/conversations/:id/messages:", e.message);
    res.status(500).json({ ok: false, message: "No se pudieron cargar los mensajes." });
  }
});

router.post("/conversations/:id/send", ...ADMIN_ONLY, async (req, res) => {
  try {
    if (!(await inboxReady())) {
      return res.status(503).json({ ok: false, message: "Falta activar la bandeja de WhatsApp en la base de datos." });
    }

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ ok: false, message: "Escribe un mensaje antes de enviar." });

    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ ok: false, message: "Conversación no encontrada." });

    if (!canReplyUntil(conversation.ventana_24h_hasta)) {
      return res.status(400).json({
        ok: false,
        message: "La ventana de atención ha caducado. Usa una plantilla aprobada para reabrir la conversación.",
      });
    }

    const result = await sendTextMessage(conversation.wa_id, message);
    const createdAt = mysqlDateFromDate(new Date());

    await query(
      `INSERT INTO whatsapp_messages
        (conversation_id, meta_message_id, direccion, tipo, contenido, estado, raw_payload, created_at)
       VALUES (?, ?, 'outbound', 'text', ?, 'enviado', ?, ?)`,
      [conversation.id, result.messageId || null, message, JSON.stringify({ provider: result.provider }), createdAt]
    );

    await query(
      `UPDATE whatsapp_conversations
       SET estado = 'abierta', ultimo_mensaje = ?, ultimo_mensaje_en = ?, atendido_por = ?
       WHERE id = ?`,
      [message, createdAt, req.user.id, conversation.id]
    );

    res.status(201).json({ ok: true, message: "Mensaje enviado.", messageId: result.messageId || null });
  } catch (e) {
    console.error("Error POST /api/whatsapp/conversations/:id/send:", e.message);
    res.status(500).json({ ok: false, message: "No se pudo enviar el mensaje." });
  }
});

router.patch("/conversations/:id/status", ...ADMIN_ONLY, async (req, res) => {
  try {
    if (!(await inboxReady())) {
      return res.status(503).json({ ok: false, message: "Falta activar la bandeja de WhatsApp en la base de datos." });
    }

    const estado = normalizeConversationStatus(String(req.body?.estado || "").toLowerCase());
    const [result] = await query(
      "UPDATE whatsapp_conversations SET estado = ?, atendido_por = ? WHERE id = ?",
      [estado, req.user.id, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ ok: false, message: "Conversación no encontrada." });
    res.json({ ok: true, message: "Estado actualizado." });
  } catch (e) {
    console.error("Error PATCH /api/whatsapp/conversations/:id/status:", e.message);
    res.status(500).json({ ok: false, message: "No se pudo actualizar la conversación." });
  }
});

export default router;
