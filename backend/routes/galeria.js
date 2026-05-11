import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);
const ADMIN_ROLES = ["admin"];
const ALLOWED_CATEGORIES = new Set(["Alumnos", "Clases", "Liga", "Torneos", "Club", "Otros"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "uploads", "galeria");

fs.mkdirSync(uploadDir, { recursive: true });

function isAdmin(user) {
  return String(user?.rol || "").toLowerCase() === "admin";
}

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

function normalizeCategory(category) {
  const clean = String(category || "Otros").trim();
  return ALLOWED_CATEGORIES.has(clean) ? clean : "Otros";
}

function publicPhoto(row) {
  return {
    id: `db-${row.id}`,
    dbId: row.id,
    title: row.titulo,
    category: row.categoria,
    src: row.archivo_url,
    highlight: "Foto del club",
    desc: row.descripcion || "Imagen compartida por la comunidad NaniPadel.",
    estado: row.estado,
    creado_en: row.creado_en,
    usuario_nombre: row.usuario_nombre || null,
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isImage = ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext);
    cb(isImage ? null : new Error("Solo se permiten imagenes JPG, PNG o WEBP."), isImage);
  },
});

function handleUpload(req, res, next) {
  upload.single("imagen")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "La imagen no puede superar 5MB."
      : err.message || "No se pudo procesar la imagen.";
    return res.status(400).json({ ok: false, message });
  });
}

// GET /api/galeria devuelve solo fotos aprobadas para combinarlas con el manifest estatico.
router.get("/", async (req, res) => {
  try {
    if (!(await tableExists("galeria_fotos"))) {
      return res.json({ ok: true, photos: [] });
    }

    const params = [];
    const filters = ["gf.estado = 'aprobada'"];
    if (req.query.categoria && req.query.categoria !== "Todas") {
      filters.push("gf.categoria = ?");
      params.push(normalizeCategory(req.query.categoria));
    }

    const [rows] = await query(
      `SELECT gf.*, u.nombre AS usuario_nombre
       FROM galeria_fotos gf
       LEFT JOIN usuarios u ON u.id = gf.usuario_id
       WHERE ${filters.join(" AND ")}
       ORDER BY gf.fecha_aprobacion DESC, gf.creado_en DESC, gf.id DESC`,
      params
    );

    res.json({ ok: true, photos: rows.map(publicPhoto) });
  } catch (e) {
    console.error("Error GET /api/galeria:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/galeria/upload fuerza el estado segun el rol real del token.
router.post("/upload", requireAuth, handleUpload, async (req, res) => {
  try {
    if (!(await tableExists("galeria_fotos"))) {
      return res.status(400).json({ ok: false, message: "Falta crear la tabla galeria_fotos." });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "Selecciona una imagen valida." });
    }

    const titulo = String(req.body.titulo || "").trim();
    if (!titulo) {
      return res.status(400).json({ ok: false, message: "El titulo es obligatorio." });
    }

    const estado = isAdmin(req.user) ? "aprobada" : "pendiente";
    const archivoUrl = `/uploads/galeria/${req.file.filename}`;
    const categoria = normalizeCategory(req.body.categoria);

    const [result] = await query(
      `INSERT INTO galeria_fotos
       (usuario_id, titulo, descripcion, categoria, archivo_url, archivo_nombre, estado, aprobado_por, fecha_aprobacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${estado === "aprobada" ? "NOW()" : "NULL"})`,
      [
        req.user.id,
        titulo,
        String(req.body.descripcion || "").trim() || null,
        categoria,
        archivoUrl,
        req.file.filename,
        estado,
        estado === "aprobada" ? req.user.id : null,
      ]
    );

    res.status(201).json({
      ok: true,
      id: result.insertId,
      estado,
      message: estado === "aprobada"
        ? "Foto subida y publicada correctamente."
        : "Foto enviada. Un administrador la revisara antes de publicarla.",
    });
  } catch (e) {
    console.error("Error POST /api/galeria/upload:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/galeria/pendientes queda reservado a administradores.
router.get("/pendientes", requireAuth, requireRoles(ADMIN_ROLES), async (_req, res) => {
  try {
    if (!(await tableExists("galeria_fotos"))) {
      return res.json({ ok: true, photos: [] });
    }

    const [rows] = await query(
      `SELECT gf.*, u.nombre AS usuario_nombre, u.email AS usuario_email
       FROM galeria_fotos gf
       LEFT JOIN usuarios u ON u.id = gf.usuario_id
       WHERE gf.estado = 'pendiente'
       ORDER BY gf.creado_en ASC`
    );

    res.json({ ok: true, photos: rows.map(publicPhoto) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch("/:id/aprobar", requireAuth, requireRoles(ADMIN_ROLES), async (req, res) => {
  try {
    await query(
      "UPDATE galeria_fotos SET estado = 'aprobada', aprobado_por = ?, fecha_aprobacion = NOW(), motivo_rechazo = NULL WHERE id = ?",
      [req.user.id, req.params.id]
    );
    res.json({ ok: true, message: "Foto aprobada." });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch("/:id/rechazar", requireAuth, requireRoles(ADMIN_ROLES), async (req, res) => {
  try {
    await query(
      "UPDATE galeria_fotos SET estado = 'rechazada', motivo_rechazo = ?, aprobado_por = NULL, fecha_aprobacion = NULL WHERE id = ?",
      [String(req.body.motivo || "").trim() || null, req.params.id]
    );
    res.json({ ok: true, message: "Foto rechazada." });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch("/:id/eliminar", requireAuth, requireRoles(ADMIN_ROLES), async (req, res) => {
  try {
    await query("UPDATE galeria_fotos SET estado = 'eliminada' WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Foto eliminada." });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
