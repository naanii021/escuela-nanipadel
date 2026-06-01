import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const query = (sql, params) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

// POST /api/auth/registro
router.post("/registro", async (req, res) => {
  try {
    const { nombre, email, telefono, password } = req.body;
    const usuarioColumns = await getTableColumns("usuarios");

    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios (nombre, email, password)" });
    }

    // Comprobar si ya existe el email
    const [existing] = await query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ ok: false, message: "Ya existe una cuenta con ese email" });
    }

    // Encriptar contraseña
    const password_hash = await bcrypt.hash(password, 10);

    const payload = {
      nombre,
      email,
      telefono: telefono || null,
      password_hash,
      nivel_juego: req.body.nivel_juego ?? null,
    };
    const fields = ["nombre", "email", "telefono", "password_hash", "nivel_juego"].filter((field) => usuarioColumns.has(field));
    const [result] = await query(
      `INSERT INTO usuarios (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      fields.map((field) => payload[field])
    );

    // Generar token directamente al registrarse
    const token = jwt.sign(
      { id: result.insertId, nombre, email, rol: "usuario", nivel_juego: payload.nivel_juego },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      ok: true,
      message: "Cuenta creada correctamente",
      token,
      user: { id: result.insertId, nombre, email, rol: "usuario", nivel_juego: payload.nivel_juego },
    });
  } catch (e) {
    console.error("Error POST /api/auth/registro:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "Faltan email o password" });
    }

    // Buscar usuario
    const [rows] = await query("SELECT * FROM usuarios WHERE email = ? AND activo = 1", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: "Email o contraseña incorrectos" });
    }

    const user = rows[0];

    // Verificar contraseña
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, message: "Email o contraseña incorrectos" });
    }

    // Generar token
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, nivel_juego: user.nivel_juego ?? null },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, nivel_juego: user.nivel_juego ?? null },
    });
  } catch (e) {
    console.error("Error POST /api/auth/login:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/auth/me (verificar token y devolver datos del usuario)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      ok: true,
      user: { id: decoded.id, nombre: decoded.nombre, email: decoded.email, rol: decoded.rol, nivel_juego: decoded.nivel_juego ?? null },
    });
  } catch (e) {
    return res.status(401).json({ ok: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." });
  }
});

export default router;
