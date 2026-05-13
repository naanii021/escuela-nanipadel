import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { db } from "./db/connection.js";
import reservasRouter from "./routes/reservas.js";
import authRouter from "./routes/auth.js";
import clasesRouter from "./routes/clases.js";
import torneosRouter from "./routes/torneos.js";
import asistenteRouter from "./routes/asistente.js";
import gestionRouter from "./routes/gestion.js";
import perfilRouter from "./routes/perfil.js";
import galeriaRouter from "./routes/galeria.js";
import notificacionesRouter from "./routes/notificaciones.js";
import { requireAuth, requireRoles } from "./middleware/auth.js";
import { sendWhatsAppMessage } from "./services/whatsappService.js";

// Cargamos variables de entorno desde .env
dotenv.config();

// Creamos la app de Express
const app = express();

// Puerto del backend
const PORT = process.env.PORT || 4000;

// Necesario para rutas de uploads y frontend estático en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// MIDDLEWARES
// ======================================================

// Permitimos peticiones desde otros orígenes
app.use(cors());

// Permite leer JSON que llegue en el body de las peticiones
app.use(express.json());

// Servimos subidas moderadas desde una carpeta controlada por el backend
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================================================
// ROUTERS
// ======================================================

// Rutas de reservas
app.use("/api/reservas", reservasRouter);

// Rutas de autenticación
app.use("/api/auth", authRouter);

// Rutas de clases
app.use("/api/clases", clasesRouter);

// Rutas de torneos
app.use("/api/torneos", torneosRouter);

// Ruta resumen para el asistente del club
app.use("/api/asistente", asistenteRouter);

// Rutas privadas de gestión para profesorado y administración
app.use("/api/gestion", gestionRouter);

// Perfil privado del usuario autenticado
app.use("/api/perfil", perfilRouter);

// Rutas de galería con subida y moderación
app.use("/api/galeria", galeriaRouter);

// Preferencias y centro de notificaciones del usuario
app.use("/api/notificaciones", notificacionesRouter);

// ======================================================
// RUTAS BÁSICAS
// ======================================================

// Ruta raíz sencilla para comprobar que el backend está vivo
app.get("/", (_req, res) => {
  res.send("Servidor NaniPadel funcionando 🚀");
});

// Ruta de prueba rápida para saber si el backend responde
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, message: "pong" });
});

// Ruta para comprobar si la conexión a MySQL está funcionando
app.get("/api/db-test", async (_req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT 1 AS ok");

    res.json({
      ok: true,
      result: rows[0],
    });
  } catch (e) {
    console.error("❌ DB TEST ERROR:", e);

    res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

// ======================================================
// ALUMNOS
// ======================================================

// Devuelve alumnos solo a staff; los visitantes nunca deben recibir nombres de alumnos
app.get(
  "/api/alumnos",
  requireAuth,
  requireRoles(["admin", "profesor", "profe"]),
  async (_req, res) => {
    try {
      const [rows] = await db.promise().query(
        "SELECT * FROM alumnos ORDER BY id"
      );

      res.json({
        ok: true,
        alumnos: rows,
      });
    } catch (e) {
      console.error("❌ Error /api/alumnos:", e);

      res.status(500).json({
        ok: false,
        message: e.message,
      });
    }
  }
);

// ======================================================
// GRUPOS / CLASES
// ======================================================

// Devuelve grupos reales solo a profesorado/administración
app.get(
  "/api/grupos",
  requireAuth,
  requireRoles(["admin", "profesor", "profe"]),
  async (req, res) => {
    console.log("🔎 GET /api/grupos");

    try {
      // Filtros opcionales recibidos por query string
      const { nivel, profesor_id, dia } = req.query;

      const filters = [];
      const values = [];

      // Filtrar por nivel
      if (nivel) {
        filters.push("g.nivel = ?");
        values.push(nivel);
      }

      // Filtrar por profesor
      if (profesor_id) {
        filters.push("g.profesor_id = ?");
        values.push(profesor_id);
      }

      // Filtrar por día (coincide con dia1 o dia2)
      if (dia) {
        filters.push("(g.dia1 = ? OR g.dia2 = ?)");
        values.push(dia, dia);
      }

      // Si hay filtros, construimos el WHERE
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

      res.json({
        ok: true,
        grupos: rows,
      });
    } catch (e) {
      console.error("❌ Error /api/grupos:", e);

      res.status(500).json({
        ok: false,
        message: e.message,
      });
    }
  }
);

// ======================================================
// METEO XIAO
// ======================================================

// Esta ruta recibe datos desde la XIAO
app.post("/api/meteo-xiao", async (req, res) => {
  try {
    const {
      temperatura,
      humedad,
      presion,
      altitud,
      bateria_voltaje,
      bateria_porcentaje,
      estado,
    } = req.body;

    // Validación básica para evitar guardar lecturas incompletas
    if (
      temperatura == null ||
      humedad == null ||
      presion == null ||
      bateria_voltaje == null ||
      bateria_porcentaje == null
    ) {
      return res.status(400).json({
        ok: false,
        message: "Faltan datos obligatorios",
      });
    }

    const sql = `
      INSERT INTO meteo_xiao
      (temperatura, humedad, presion, altitud, bateria_voltaje, bateria_porcentaje, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      temperatura,
      humedad,
      presion,
      altitud ?? null,
      bateria_voltaje,
      bateria_porcentaje,
      estado ?? null,
    ];

    const [result] = await db.promise().query(sql, values);

    res.json({
      ok: true,
      message: "Datos meteorológicos guardados correctamente",
      id: result.insertId,
    });
  } catch (e) {
    console.error("❌ Error /api/meteo-xiao POST:", e);

    res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

// Devuelve la última lectura meteorológica guardada
app.get("/api/meteo-xiao", async (_req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT *
      FROM meteo_xiao
      ORDER BY creado_en DESC
      LIMIT 1
    `);

    res.json({
      ok: true,
      meteo: rows[0] || null,
    });
  } catch (e) {
    console.error("❌ Error /api/meteo-xiao GET:", e);

    res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

// Alias más claro para frontend
app.get("/api/meteo-xiao/latest", async (_req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT *
      FROM meteo_xiao
      ORDER BY creado_en DESC
      LIMIT 1
    `);

    res.json({
      ok: true,
      meteo: rows[0] || null,
    });
  } catch (e) {
    console.error("❌ Error /api/meteo-xiao/latest GET:", e);

    res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

// ======================================================
// WHATSAPP TEST
// ======================================================

// Ruta temporal para probar el envío de WhatsApp.
// Cambia el número "to" por tu número real con prefijo internacional.
app.get("/api/test-whatsapp", async (_req, res) => {
  try {
    const result = await sendWhatsAppMessage({
      to: "+34622040926",
      body: "Prueba de WhatsApp desde NaniPadel 🚀",
    });

    res.json({
      ok: true,
      sid: result.sid,
      message: "WhatsApp enviado correctamente",
    });
  } catch (e) {
    console.error("❌ Error enviando WhatsApp de prueba:", e);

    res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

// ======================================================
// FRONTEND ESTÁTICO
// ======================================================

// Ruta a la carpeta build del frontend
const buildPath = path.join(__dirname, "..", "frontend", "build");

// Servimos los archivos estáticos del frontend compilado
app.use(express.static(buildPath));

// Cualquier ruta no-API devuelve index.html para que React Router funcione
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ======================================================
// ARRANQUE DEL SERVIDOR
// ======================================================

// Arrancamos el backend escuchando en todas las interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend activo en http://localhost:${PORT}`);
});