// Importaciones modernas (ESM)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2";

// Configurar variables de entorno
dotenv.config();

// Crear app
const app = express();
app.use(cors());
app.use(express.json());

// Crear conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Conexión a MySQL
db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con MySQL:", err);
  } else {
    console.log("✅ Conectado correctamente a MySQL");
  }
});

// Ruta básica
app.get("/", (req, res) => {
  res.send("¡Backend funcionando!");
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend activo en http://localhost:${PORT}`);
});
