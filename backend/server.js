import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db/connection.js";

dotenv.config();

const app = express();

// Puerto seguro (si no hay .env)
const PORT = process.env.PORT || 4000;

// CORS: permite que tu React (CRA) consuma la API
app.use(
  cors({
    origin: "http://localhost:3000", // IMPORTANTE: CRA usa 3000
  })
);

// Permite recibir JSON en body
app.use(express.json());

// Ping para comprobar que el backend responde
app.get("/", (_req, res) => res.send("Servidor NaniPadel funcionando 🚀"));

// Endpoint de prueba: lista alumnos (prueba real de conexión a MySQL)
app.get("/alumnos", (_req, res) => {
  db.query("SELECT * FROM alumnos", (err, rows) => {
    // Si hay error, devolvemos 500 con el mensaje
    if (err) return res.status(500).json({ error: err.message });

    // Si todo va bien, devolvemos las filas
    res.json(rows);
  });
});

// Arranque del servidor
app.listen(PORT, () => {
  console.log(`✅ Backend activo en http://localhost:${PORT}`);
});
