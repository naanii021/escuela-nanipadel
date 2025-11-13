import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db/connection.js";
dotenv.config();

const app = express();
app.use(cors({
  origin: "https://locahost:5173",
}));
app.use(express.json());

// Ping
app.get("/", (_req, res) => res.send("Servidor NaniPadel funcionando 🚀"));

// Endpoint de prueba: lista alumnos
app.get("/alumnos", (_req, res) => {
  db.query("SELECT * FROM alumnos", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Backend activo en http://localhost:${process.env.PORT}`);
});
