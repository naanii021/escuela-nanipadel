import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";

// Middleware opcional de auth
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

// GET /api/clases/mis-clases (clases del usuario logueado)
router.get("/mis-clases", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ ok: true, clases: [] });
    }

    // Buscar alumno vinculado a este usuario
    const [alumnos] = await query(
      "SELECT id FROM alumnos WHERE usuario_id = ? AND activo = 1",
      [req.user.id]
    );

    if (alumnos.length === 0) {
      return res.json({ ok: true, clases: [], mensaje: "No tienes perfil de alumno vinculado" });
    }

    const alumnoId = alumnos[0].id;

    const [rows] = await query(
      `SELECT
        g.id,
        g.codigo,
        g.nombre,
        g.nivel,
        g.dia1,
        g.dia2,
        g.hora_inicio,
        g.duracion_min,
        g.pista_habitual,
        g.cupo,
        CONCAT(p.nombre, ' ', p.apellidos) AS profesor
      FROM grupo_alumnos ga
      JOIN grupos g ON g.id = ga.grupo_id AND g.activo = 1
      JOIN profesores p ON p.id = g.profesor_id
      WHERE ga.alumno_id = ? AND ga.activo = 1
      ORDER BY g.hora_inicio`,
      [alumnoId]
    );

    res.json({ ok: true, clases: rows });
  } catch (e) {
    console.error("Error GET /api/clases/mis-clases:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;