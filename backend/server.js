import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db/connection.js";
import reservasRouter from "./routes/reservas.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS para React
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// JSON body
app.use(express.json());

// Usar el router de reservas
app.use("/api/reservas", reservasRouter);

// Usar el router de auth
app.use("/api/auth", authRouter);


// Root
app.get("/", (_req, res) => res.send("Servidor NaniPadel funcionando 🚀"));

// Ping
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, message: "pong" });
});

// Test DB
app.get("/api/db-test", async (_req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT 1 AS ok");
    res.json({ ok: true, result: rows[0] });
  } catch (e) {
    console.error("❌ DB TEST ERROR:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Listar alumnos (en formato consistente)
app.get("/api/alumnos", async (_req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM alumnos ORDER BY id");
    res.json({ ok: true, alumnos: rows });
  } catch (e) {
    console.error("❌ Error /api/alumnos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ✅ Listar grupos (clases) con profesor + nº alumnos
app.get("/api/grupos", async (req, res) => {
  console.log("🔎 GET /api/grupos");
  try {
    const { nivel, profesor_id, dia } = req.query;

    const filters = [];
    const values = [];

    if (nivel) {
      filters.push("g.nivel = ?");
      values.push(nivel);
    }

    if (profesor_id) {
      filters.push("g.profesor_id = ?");
      values.push(profesor_id);
    }

    if (dia) {
      filters.push("(g.dia1 = ? OR g.dia2 = ?)");
      values.push(dia, dia);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await db.promise().query(
      `
      SELECT
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
        g.activo,
        p.id AS profesor_id,
        CONCAT(p.nombre, ' ', p.apellidos) AS profesor,
        COUNT(ga.alumno_id) AS alumnos
      FROM grupos g
      JOIN profesores p ON p.id = g.profesor_id
      LEFT JOIN grupo_alumnos ga ON ga.grupo_id = g.id AND ga.activo = 1
      ${where}
      GROUP BY
        g.id, g.codigo, g.nombre, g.nivel, g.dia1, g.dia2, g.hora_inicio,
        g.duracion_min, g.pista_habitual, g.cupo, g.activo,
        p.id, p.nombre, p.apellidos
      ORDER BY g.hora_inicio, g.codigo
      `,
      values
    );

    res.json({ ok: true, grupos: rows });
  } catch (e) {
    console.error("❌ Error /api/grupos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Arranque del servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend activo en http://localhost:${PORT}`);
});
