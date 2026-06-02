import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/security.js";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);
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

function normalizeDayLetter(value) {
  const map = {
    L: 1,
    M: 2,
    X: 3,
    J: 4,
    V: 5,
    S: 6,
    D: 0,
  };
  return map[value] ?? null;
}

function getNextClassOccurrence(clase) {
  const now = new Date();
  const letters = [clase.dia1, clase.dia2].filter(Boolean);

  let best = null;

  for (const letter of letters) {
    const targetDay = normalizeDayLetter(letter);
    if (targetDay == null) continue;

    const [hour = 0, minute = 0] = String(clase.hora_inicio || "00:00")
      .split(":")
      .map(Number);

    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);

    let diff = targetDay - now.getDay();
    if (diff < 0) diff += 7;
    candidate.setDate(candidate.getDate() + diff);

    if (candidate < now) {
      candidate.setDate(candidate.getDate() + 7);
    }

    if (!best || candidate < best.nextDate) {
      best = { ...clase, nextDate: candidate.toISOString() };
    }
  }

  return best;
}

async function safeQuery(label, sql, params, warnings) {
  try {
    const [rows] = await query(sql, params);
    return rows;
  } catch (e) {
    console.error(`Error asistente ${label}:`, e);
    warnings.push(`No se ha podido cargar ${label}.`);
    return [];
  }
}

router.get("/summary", optionalAuth, async (req, res) => {
  const warnings = [];

  try {
    const torneosRows = await safeQuery(
      "torneos",
      `SELECT id, nombre, categoria, fecha_inicio, hora_inicio, estado
       FROM torneos
       WHERE estado IN ('abierto', 'proximo')
       ORDER BY fecha_inicio ASC, hora_inicio ASC
       LIMIT 3`,
      [],
      warnings
    );

    const meteoRows = await safeQuery(
      "estado de pista",
      `SELECT temperatura, humedad, presion, estado, creado_en
       FROM meteo_xiao
       ORDER BY creado_en DESC
       LIMIT 1`,
      [],
      warnings
    );

    const summary = {
      ok: true,
      warnings,
      logged: Boolean(req.user),
      user: req.user
        ? { id: req.user.id, nombre: req.user.nombre, rol: req.user.rol }
        : null,
      general: {
        torneosAbiertos: torneosRows,
        estadoPista: meteoRows[0] || null,
        help: [
          "Puedes revisar reservas, clases, torneos y estado de pista desde el asistente.",
          "Si no has iniciado sesión, el asistente muestra información general del club.",
        ],
      },
      personal: {
        proximaClase: null,
        proximasReservas: [],
      },
      data: {
        user: req.user ? { id: req.user.id, nombre: req.user.nombre, rol: req.user.rol } : null,
        torneos: {
          proximos: torneosRows,
          abiertos: torneosRows.filter((torneo) => torneo.estado === "abierto"),
        },
        estadoPista: meteoRows[0] || null,
        reservas: [],
        claseProxima: null,
        notificaciones: { unread: 0, items: [], available: false },
      },
    };

    if (!req.user) {
      return res.json(summary);
    }

    const reservasRows = await safeQuery(
      "reservas próximas",
      `SELECT r.id, r.fecha, r.hora_inicio, p.nombre AS pista_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       WHERE r.usuario_id = ? AND r.estado != 'cancelada' AND r.fecha >= CURDATE()
       ORDER BY r.fecha ASC, r.hora_inicio ASC
       LIMIT 3`,
      [req.user.id],
      warnings
    );

    const alumnos = await safeQuery(
      "alumno vinculado",
      "SELECT id FROM alumnos WHERE usuario_id = ? AND activo = 1 LIMIT 1",
      [req.user.id],
      warnings
    );

    let nextClass = null;

    if (alumnos.length > 0) {
      const alumnoId = alumnos[0].id;
      const clasesRows = await safeQuery(
        "clases próximas",
        `SELECT
          g.id,
          g.nombre,
          g.nivel,
          g.dia1,
          g.dia2,
          g.hora_inicio,
          g.pista_habitual,
          CONCAT(p.nombre, ' ', p.apellidos) AS profesor
        FROM grupo_alumnos ga
        JOIN grupos g ON g.id = ga.grupo_id AND g.activo = 1
        JOIN profesores p ON p.id = g.profesor_id
        WHERE ga.alumno_id = ? AND ga.activo = 1`,
        [alumnoId],
        warnings
      );

      nextClass = clasesRows
        .map(getNextClassOccurrence)
        .filter(Boolean)
        .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))[0] || null;
    }

    summary.personal.proximaClase = nextClass;
    summary.personal.proximasReservas = reservasRows;
    summary.data.reservas = reservasRows;
    summary.data.claseProxima = nextClass;

    res.json(summary);
  } catch (e) {
    console.error("Error GET /api/asistente/summary:", e);
    res.status(500).json({ ok: false, message: "No se ha podido cargar el resumen del asistente." });
  }
});

export default router;
