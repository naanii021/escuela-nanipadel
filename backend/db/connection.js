import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

// Creamos un pool de conexiones en lugar de una sola conexión.
// Así MySQL puede abrir, reutilizar y renovar conexiones automáticamente.
export const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,

  // Espera si no hay conexiones libres
  waitForConnections: true,

  // Número máximo de conexiones simultáneas
  connectionLimit: 10,

  // Sin límite de cola de espera
  queueLimit: 0,
});

// Hacemos una prueba de conexión al arrancar para comprobar que MySQL responde
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error al conectar con MySQL:", err);
    return;
  }

  console.log("✅ Conectado correctamente a MySQL");

  // Muy importante: liberar la conexión para devolverla al pool
  connection.release();
});