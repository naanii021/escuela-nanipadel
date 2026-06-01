import express from "express";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import {
  getOrCreateNotificationPreferences,
  NOTIFICATION_EVENTS,
  notifyEvent,
  updateNotificationPreferences,
} from "../services/notificationService.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);

router.use(requireAuth);

const STAFF_ROLES = ["admin", "profesor", "profe"];
const ALLOWED_PRIORITIES = new Set(["normal", "importante", "urgente"]);
const TYPE_CONFIG = {
  aviso_club: { eventType: NOTIFICATION_EVENTS.AVISO_CLUB, category: "club" },
  club: { eventType: NOTIFICATION_EVENTS.AVISO_CLUB, category: "club" },
  aviso_profesor: { eventType: NOTIFICATION_EVENTS.AVISO_PROFESOR, category: "clases" },
  clase: { eventType: NOTIFICATION_EVENTS.AVISO_PROFESOR, category: "clases" },
  clases: { eventType: NOTIFICATION_EVENTS.AVISO_PROFESOR, category: "clases" },
  torneo: { eventType: NOTIFICATION_EVENTS.TORNEO_EVENTO, category: "torneos" },
  torneos: { eventType: NOTIFICATION_EVENTS.TORNEO_EVENTO, category: "torneos" },
  reserva: { eventType: NOTIFICATION_EVENTS.AVISO_CLUB, category: "reservas" },
  reservas: { eventType: NOTIFICATION_EVENTS.AVISO_CLUB, category: "reservas" },
};

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

function normalizeAudience(value) {
  const audience = String(value || "all_users").toLowerCase();
  if (["all_users", "todos"].includes(audience)) return "all_users";
  if (["students", "alumnos", "solo_alumnos"].includes(audience)) return "students";
  if (["professors", "profesores", "solo_profesores"].includes(audience)) return "professors";
  if (["staff", "equipo"].includes(audience)) return "staff";
  if (["group", "grupo", "clase"].includes(audience)) return "group";
  if (["custom", "usuarios", "specific_users", "specific_user"].includes(audience)) return "specific_users";
  return "all_users";
}

async function resolveAvisoRecipientIds({ audience, recipientUserIds = [], groupId = null }) {
  const uniqueIds = [...new Set((recipientUserIds || []).map(Number).filter(Boolean))];
  if (uniqueIds.length) return uniqueIds;

  if (audience === "all_users") return [];

  if (audience === "specific_users") return uniqueIds;

  if (audience === "staff" || audience === "professors") {
    const roles = audience === "staff" ? STAFF_ROLES : ["profesor", "profe"];
    const [rows] = await query(
      `SELECT id FROM usuarios WHERE rol IN (${roles.map(() => "?").join(", ")}) AND COALESCE(activo, 1) = 1`,
      roles
    );
    return rows.map((row) => row.id);
  }

  if (audience === "students") {
    if ((await tableExists("alumnos"))) {
      const columns = await getTableColumns("alumnos");
      if (columns.has("usuario_id")) {
        const activeFilter = columns.has("activo") ? "AND COALESCE(a.activo, 1) = 1" : "";
        const [rows] = await query(
          `SELECT DISTINCT a.usuario_id AS id
           FROM alumnos a
           JOIN usuarios u ON u.id = a.usuario_id
           WHERE a.usuario_id IS NOT NULL ${activeFilter} AND COALESCE(u.activo, 1) = 1`
        );
        return rows.map((row) => row.id);
      }
    }

    const [rows] = await query(
      "SELECT id FROM usuarios WHERE rol = 'usuario' AND COALESCE(activo, 1) = 1"
    );
    return rows.map((row) => row.id);
  }

  if (audience === "group" && groupId) {
    if ((await tableExists("grupo_alumnos")) && (await tableExists("alumnos"))) {
      const [rows] = await query(
        `SELECT DISTINCT a.usuario_id AS id
         FROM grupo_alumnos ga
         JOIN alumnos a ON a.id = ga.alumno_id
         JOIN usuarios u ON u.id = a.usuario_id
         WHERE ga.grupo_id = ? AND COALESCE(ga.activo, 1) = 1
           AND a.usuario_id IS NOT NULL AND COALESCE(u.activo, 1) = 1`,
        [groupId]
      );
      return rows.map((row) => row.id);
    }
  }

  return [];
}

router.get("/preferencias", async (req, res) => {
  try {
    const preferences = await getOrCreateNotificationPreferences(req.user.id);
    res.json({ ok: true, preferences });
  } catch (e) {
    console.error("Error GET /api/notificaciones/preferencias:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.put("/preferencias", async (req, res) => {
  try {
    const preferences = await updateNotificationPreferences(req.user.id, req.body);
    res.json({ ok: true, message: "Preferencias de aviso guardadas", preferences });
  } catch (e) {
    console.error("Error PUT /api/notificaciones/preferencias:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const filter = String(req.query.filter || "todos").toLowerCase();
    const status = String(req.query.status || "all").toLowerCase();
    const activeOnly = ["1", "true", "yes"].includes(String(req.query.active || "").toLowerCase());
    const importantOnly = ["1", "true", "yes"].includes(String(req.query.important || "").toLowerCase());

    const where = ["usuario_id = ?", "canal = 'in_app'"];
    const params = [req.user.id];

    if (status === "unread" || status === "activos") {
      where.push("read_at IS NULL");
    } else if (status === "read" || status === "leidos") {
      where.push("read_at IS NOT NULL");
    }

    if (filter !== "todos" && filter !== "all") {
      if (filter === "importantes") {
        where.push("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.priority')), 'normal') IN ('importante', 'urgente')");
      } else if (filter === "reservas") {
        where.push("(tipo IN (?, ?) OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') = ?)");
        params.push(NOTIFICATION_EVENTS.RESERVA_CREADA, NOTIFICATION_EVENTS.RESERVA_CANCELADA, "reservas");
      } else if (filter === "clases") {
        where.push("(tipo IN (?, ?, ?) OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') = ?)");
        params.push(
          NOTIFICATION_EVENTS.CLASE_CANCELADA,
          NOTIFICATION_EVENTS.CLASE_REPROGRAMADA,
          NOTIFICATION_EVENTS.AVISO_PROFESOR,
          "clases"
        );
      } else if (filter === "torneos") {
        where.push("(tipo = ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') = ?)");
        params.push(NOTIFICATION_EVENTS.TORNEO_EVENTO, "torneos");
      } else if (filter === "club") {
        where.push("(tipo = ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') = ?)");
        params.push(NOTIFICATION_EVENTS.AVISO_CLUB, "club");
      } else {
        where.push("(tipo = ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') = ?)");
        params.push(filter, filter);
      }
    }

    if (activeOnly) {
      where.push(
        `(JSON_EXTRACT(payload, '$.starts_at') IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.starts_at')) <= NOW())`
      );
      where.push(
        `(JSON_EXTRACT(payload, '$.expires_at') IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.expires_at')) = '' OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.expires_at')) >= NOW())`
      );
    }

    if (importantOnly) {
      where.push("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.priority')), 'normal') IN ('importante', 'urgente')");
    }

    const [rows] = await query(
      `SELECT
        id,
        tipo,
        canal,
        titulo AS title,
        mensaje AS body,
        estado,
        read_at,
        created_at,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.priority')), 'normal') AS priority,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')), '') AS category,
        JSON_UNQUOTE(JSON_EXTRACT(payload, '$.audience')) AS audience,
        JSON_UNQUOTE(JSON_EXTRACT(payload, '$.starts_at')) AS starts_at,
        JSON_UNQUOTE(JSON_EXTRACT(payload, '$.expires_at')) AS expires_at
       FROM notifications
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, limit]
    );

    const [countRows] = await query(
      `SELECT
        SUM(read_at IS NULL) AS unread_count,
        SUM(read_at IS NOT NULL) AS read_count,
        COUNT(*) AS total
       FROM notifications
       WHERE usuario_id = ? AND canal = 'in_app'`,
      [req.user.id]
    );

    res.json({
      ok: true,
      notifications: rows,
      unread_count: Number(countRows[0]?.unread_count || 0),
      read_count: Number(countRows[0]?.read_count || 0),
      total: Number(countRows[0]?.total || 0),
    });
  } catch (e) {
    console.error("Error GET /api/notificaciones:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE usuario_id = ? AND canal = 'in_app' AND read_at IS NULL`,
      [req.user.id]
    );

    res.json({ ok: true, unread: Number(rows[0]?.total || 0) });
  } catch (e) {
    console.error("Error GET /api/notificaciones/unread-count:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ ok: false, message: "Notificación no válida" });
    }

    const [result] = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW()), estado = 'read'
       WHERE id = ? AND usuario_id = ? AND canal = 'in_app'`,
      [notificationId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Notificación no encontrada" });
    }

    res.json({ ok: true, message: "Notificación marcada como leída" });
  } catch (e) {
    console.error("Error PATCH /api/notificaciones/:id/read:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW()), estado = 'read'
       WHERE usuario_id = ? AND canal = 'in_app' AND read_at IS NULL`,
      [req.user.id]
    );

    res.json({ ok: true, message: "Notificaciones marcadas como leídas" });
  } catch (e) {
    console.error("Error PATCH /api/notificaciones/read-all:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post(
  "/avisos",
  requireRoles(STAFF_ROLES),
  async (req, res) => {
    try {
      const title = String(req.body.title || req.body.titulo || "").trim();
      const body = String(req.body.body || req.body.mensaje || "").trim();
      const typeKey = String(req.body.type || "aviso_club").toLowerCase();
      const typeConfig = TYPE_CONFIG[typeKey] || TYPE_CONFIG.aviso_club;
      const priority = ALLOWED_PRIORITIES.has(String(req.body.priority))
        ? String(req.body.priority)
        : "normal";
      const audience = normalizeAudience(req.body.audience);
      const groupId = req.body.groupId || req.body.grupoId || req.body.grupo_id || null;
      const startsAt = req.body.starts_at || req.body.start_at || req.body.fecha_inicio || null;
      const expiresAt = req.body.expires_at || req.body.end_at || req.body.fecha_fin || null;
      const sendWhatsapp = req.body.sendWhatsapp === true || req.body.sendWhatsapp === 1 || req.body.sendWhatsapp === "1";
      const sendInApp = req.body.sendInApp !== false && req.body.inApp !== false;

      if (!title || !body) {
        return res.status(400).json({ ok: false, message: "Título y mensaje son obligatorios" });
      }

      const recipientUserIds = await resolveAvisoRecipientIds({
        audience,
        recipientUserIds: req.body.recipientUserIds,
        groupId,
      });

      if (audience !== "all_users" && recipientUserIds.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No se han encontrado destinatarios para este aviso",
        });
      }

      const channels = ["email"];
      if (sendInApp) channels.push("in_app");
      if (sendWhatsapp) channels.push("whatsapp");

      const result = await notifyEvent({
        type: typeConfig.eventType,
        category: typeConfig.category,
        audience: audience === "all_users" ? "all_users" : undefined,
        recipientUserIds,
        createdByUserId: req.user.id,
        title,
        body,
        channels,
        payload: {
          priority,
          category: typeConfig.category,
          audience,
          group_id: groupId,
          starts_at: startsAt,
          expires_at: expiresAt,
          send_whatsapp: sendWhatsapp,
        },
      });

      res.status(201).json({
        ok: true,
        message: "Aviso creado correctamente",
        result,
      });
    } catch (e) {
      console.error("Error POST /api/notificaciones/avisos:", e);
      res.status(500).json({ ok: false, message: e.message });
    }
  }
);

export default router;
