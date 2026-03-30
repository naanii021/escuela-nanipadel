import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";

// Middleware para extraer usuario del token (opcional, no bloquea)
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

// Middleware que SÍ bloquea si no hay token válido
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Debes iniciar sesión" });
  }
  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token inválido o expirado" });
  }
}

// GET /api/reservas?fecha=2026-03-30&pista_id=1
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { fecha, pista_id } = req.query;

    const filters = [];
    const values = [];

    if (fecha) {
      filters.push("r.fecha = ?");
      values.push(fecha);
    }

    if (pista_id) {
      filters.push("r.pista_id = ?");
      values.push(pista_id);
    }

    filters.push("r.estado != 'cancelada'");

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await query(
      `SELECT 
        r.id,
        r.alumno_id,
        r.usuario_id,
        r.nombre_cliente,
        r.telefono_cliente,
        r.pista_id,
        p.nombre AS pista_nombre,
        r.fecha,
        r.hora_inicio,
        r.duracion_min,
        r.estado,
        r.notas,
        r.creado_en
      FROM reservas_pista r
      JOIN pistas p ON p.id = r.pista_id
      ${where}
      ORDER BY r.hora_inicio, r.pista_id`,
      values
    );

    res.json({ ok: true, reservas: rows });
  } catch (e) {
    console.error("Error GET /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/reservas/pistas
router.get("/pistas", async (_req, res) => {
  try {
    const [rows] = await query(
      "SELECT id, nombre FROM pistas WHERE activa = 1 ORDER BY id"
    );
    res.json({ ok: true, pistas: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/reservas (requiere login)
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      nombre_cliente,
      telefono_cliente,
      pista_id,
      fecha,
      hora_inicio,
      duracion_min,
      notas,
    } = req.body;

    if (!pista_id || !fecha || !hora_inicio) {
      return res.status(400).json({
        ok: false,
        message: "Faltan campos obligatorios (pista_id, fecha, hora_inicio)",
      });
    }

    // Comprobar que no esté ya ocupada
    const [existing] = await query(
      `SELECT id FROM reservas_pista 
       WHERE pista_id = ? AND fecha = ? AND hora_inicio = ? AND estado != 'cancelada'`,
      [pista_id, fecha, hora_inicio]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        message: "Esa pista ya está reservada en esa fecha y hora",
      });
    }

    // Comprobar que el usuario no tenga ya una reserva ese día
const [userReservas] = await query(
  `SELECT id FROM reservas_pista 
   WHERE usuario_id = ? AND fecha = ? AND estado != 'cancelada'`,
  [req.user.id, fecha]
);

if (userReservas.length > 0) {
  return res.status(409).json({
    ok: false,
    message: "Ya tienes una reserva para este día. Solo se permite una reserva por día.",
  });
}

    const [result] = await query(
      `INSERT INTO reservas_pista 
        (usuario_id, nombre_cliente, telefono_cliente, pista_id, fecha, hora_inicio, duracion_min, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        nombre_cliente || req.user.nombre,
        telefono_cliente || null,
        pista_id,
        fecha,
        hora_inicio,
        duracion_min || 60,
        notas || null,
      ]
    );

    res.status(201).json({
      ok: true,
      id: result.insertId,
      message: "Reserva creada correctamente",
    });
  } catch (e) {
    console.error("Error POST /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /api/reservas/:id/cancelar (solo el dueño o admin)
router.patch("/:id/cancelar", requireAuth, async (req, res) => {
  try {
    // Buscar la reserva
    const [rows] = await query(
      "SELECT id, usuario_id FROM reservas_pista WHERE id = ? AND estado != 'cancelada'",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Reserva no encontrada" });
    }

    const reserva = rows[0];

    // Solo puede cancelar el dueño o un admin
    if (reserva.usuario_id !== req.user.id && req.user.rol !== "admin") {
      return res.status(403).json({ ok: false, message: "No puedes cancelar esta reserva" });
    }

    await query(
      "UPDATE reservas_pista SET estado = 'cancelada' WHERE id = ?",
      [req.params.id]
    );

    res.json({ ok: true, message: "Reserva cancelada" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;