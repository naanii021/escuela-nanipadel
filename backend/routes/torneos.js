import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";

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

function requireAdmin(req, res, next) {
  if (req.user.rol !== "profesor" && req.user.rol !== "admin") {
    return res.status(403).json({ ok: false, message: "No tienes permisos para esta acción" });
  }
  next();
}

// GET /api/torneos (listar todos los torneos)
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { categoria, estado } = req.query;

    const filters = [];
    const values = [];

    if (categoria) {
      filters.push("t.categoria = ?");
      values.push(categoria);
    }

    if (estado) {
      filters.push("t.estado = ?");
      values.push(estado);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await query(
      `SELECT 
        t.*,
        COUNT(ti.id) AS inscritos
      FROM torneos t
      LEFT JOIN torneo_inscripciones ti ON ti.torneo_id = t.id AND ti.estado != 'cancelada'
      ${where}
      GROUP BY t.id
      ORDER BY t.fecha_inicio ASC`,
      values
    );

    // Si el usuario está logueado, añadir si está inscrito en cada torneo
    if (req.user) {
      const [misInscripciones] = await query(
        "SELECT torneo_id FROM torneo_inscripciones WHERE usuario_id = ? AND estado != 'cancelada'",
        [req.user.id]
      );
      const misIds = new Set(misInscripciones.map((i) => i.torneo_id));
      rows.forEach((t) => {
        t.inscrito = misIds.has(t.id);
      });
    }

    res.json({ ok: true, torneos: rows });
  } catch (e) {
    console.error("Error GET /api/torneos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/torneos (crear torneo - solo profesor/admin)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      nombre, descripcion, categoria, modalidad,
      fecha_inicio, fecha_fin, hora_inicio, nivel,
      edad_min, edad_max, max_parejas, precio, estado,
    } = req.body;

    if (!nombre || !categoria || !fecha_inicio) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios (nombre, categoria, fecha_inicio)" });
    }

    const [result] = await query(
      `INSERT INTO torneos (nombre, descripcion, categoria, modalidad, fecha_inicio, fecha_fin, hora_inicio, nivel, edad_min, edad_max, max_parejas, precio, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, descripcion || null, categoria, modalidad || null,
        fecha_inicio, fecha_fin || null, hora_inicio || null, nivel || null,
        edad_min || null, edad_max || null, max_parejas || 16, precio || 0,
        estado || "proximo", req.user.id,
      ]
    );

    res.status(201).json({ ok: true, id: result.insertId, message: "Torneo creado" });
  } catch (e) {
    console.error("Error POST /api/torneos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/torneos/:id/inscribirse (inscribirse en un torneo)
router.post("/:id/inscribirse", requireAuth, async (req, res) => {
  try {
    const torneoId = req.params.id;
    const { nombre_pareja, telefono_contacto } = req.body;

    // Comprobar que el torneo existe y está abierto
    const [torneos] = await query(
      "SELECT * FROM torneos WHERE id = ? AND estado IN ('abierto', 'proximo')",
      [torneoId]
    );

    if (torneos.length === 0) {
      return res.status(404).json({ ok: false, message: "Torneo no encontrado o no disponible" });
    }

    const torneo = torneos[0];

    // Comprobar si ya está inscrito
    const [existing] = await query(
      "SELECT id FROM torneo_inscripciones WHERE torneo_id = ? AND usuario_id = ? AND estado != 'cancelada'",
      [torneoId, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ ok: false, message: "Ya estás inscrito en este torneo" });
    }

    // Comprobar si hay plazas
    const [countResult] = await query(
      "SELECT COUNT(*) AS total FROM torneo_inscripciones WHERE torneo_id = ? AND estado != 'cancelada'",
      [torneoId]
    );

    if (torneo.max_parejas && countResult[0].total >= torneo.max_parejas) {
      return res.status(409).json({ ok: false, message: "No quedan plazas disponibles" });
    }

    await query(
      "INSERT INTO torneo_inscripciones (torneo_id, usuario_id, nombre_pareja, telefono_contacto) VALUES (?, ?, ?, ?)",
      [torneoId, req.user.id, nombre_pareja || null, telefono_contacto || null]
    );

    res.status(201).json({ ok: true, message: "Inscripción realizada" });
  } catch (e) {
    console.error("Error POST /api/torneos/:id/inscribirse:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /api/torneos/:id/cancelar-inscripcion
router.patch("/:id/cancelar-inscripcion", requireAuth, async (req, res) => {
  try {
    const [result] = await query(
      "UPDATE torneo_inscripciones SET estado = 'cancelada' WHERE torneo_id = ? AND usuario_id = ? AND estado != 'cancelada'",
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "No estás inscrito en este torneo" });
    }

    res.json({ ok: true, message: "Inscripción cancelada" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;