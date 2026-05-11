import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notificationService.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);

router.use(requireAuth);

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
    const [rows] = await query(
      `SELECT
        id,
        tipo,
        canal,
        titulo AS title,
        mensaje AS body,
        estado,
        read_at,
        created_at
       FROM notifications
       WHERE usuario_id = ? AND canal = 'in_app'
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    res.json({ ok: true, notifications: rows });
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
      return res.status(400).json({ ok: false, message: "Notificacion no valida" });
    }

    const [result] = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW()), estado = 'read'
       WHERE id = ? AND usuario_id = ? AND canal = 'in_app'`,
      [notificationId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Notificacion no encontrada" });
    }

    res.json({ ok: true, message: "Notificacion marcada como leida" });
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

    res.json({ ok: true, message: "Notificaciones marcadas como leidas" });
  } catch (e) {
    console.error("Error PATCH /api/notificaciones/read-all:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
