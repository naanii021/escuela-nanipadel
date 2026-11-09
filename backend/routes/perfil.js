import bcrypt from "bcrypt";
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { updateNotificationPreferences } from "../services/notificationService.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);
const PROFESSIONAL_ROLES = ["admin", "profesor", "profe"];

const PERSONAL_FIELDS = [
  "nombre",
  "apellidos",
  "email",
  "telefono",
  "foto_perfil_url",
  "nivel_juego",
  "mano_dominante",
  "lado_preferido",
  "ciudad",
  "club_habitual",
  "disponibilidad_general",
  "preferencias_notificacion",
  "buscar_partidas_abiertas",
  "privacidad_perfil",
];

const PROFESSIONAL_FIELDS = [
  "zona_trabajo",
  "ciudad_base",
  "pueblos_trabajo",
  "club_principal",
  "otros_clubes",
  "tiene_club_propio",
  "nombre_club_propio",
  "especialidades",
  "anos_experiencia",
  "niveles_que_entrena",
  "disponibilidad_laboral",
  "biografia_profesional",
  "instagram_profesional",
  "telefono_profesional",
];

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

function selectField(columns, field) {
  return columns.has(field) ? field : `NULL AS ${field}`;
}

function pickWritableFields(payload, allowedFields, columns) {
  const fields = [];
  const values = [];

  allowedFields.forEach((field) => {
    if (columns.has(field) && Object.prototype.hasOwnProperty.call(payload, field)) {
      fields.push(field);
      values.push(payload[field] === "" ? null : payload[field]);
    }
  });

  return { fields, values };
}

function normalizeBoolean(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return value;
}

function validatePersonalPayload(payload) {
  const nivelJuego = payload.nivel_juego;
  if (nivelJuego !== undefined && nivelJuego !== null && nivelJuego !== "") {
    const parsed = Number(nivelJuego);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
      return "El nivel de juego debe estar entre 0 y 6";
    }
    payload.nivel_juego = parsed;
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email))) {
    return "Introduce un email valido";
  }

  if (payload.mano_dominante && !["derecha", "izquierda"].includes(payload.mano_dominante)) {
    return "Mano dominante no valida";
  }

  if (payload.lado_preferido && !["drive", "reves", "ambos"].includes(payload.lado_preferido)) {
    return "Lado preferido no valido";
  }

  payload.buscar_partidas_abiertas = normalizeBoolean(payload.buscar_partidas_abiertas);
  return null;
}

function hasPayloadField(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function buildNotificationPreferencePayload(payload) {
  const hasWhatsappEnabled = hasPayloadField(payload, "whatsapp_enabled");
  const hasWhatsappPhone = hasPayloadField(payload, "whatsapp_phone");

  if (!hasWhatsappEnabled && !hasWhatsappPhone) return null;

  const whatsappEnabled = hasWhatsappEnabled
    ? normalizeBoolean(payload.whatsapp_enabled)
    : undefined;
  const whatsappPhone = hasWhatsappPhone
    ? String(payload.whatsapp_phone || "").trim()
    : String(payload.telefono || "").trim();

  if (Number(whatsappEnabled) === 1 && !whatsappPhone) {
    return {
      error: "Añade un número de teléfono para recibir avisos por WhatsApp.",
    };
  }

  return {
    preferences: {
      ...(hasWhatsappEnabled ? { whatsapp_enabled: whatsappEnabled } : {}),
      whatsapp_phone: whatsappPhone || null,
    },
  };
}

async function fetchProfile(userId) {
  const columns = await getTableColumns("usuarios");
  const selectFields = [
    "id",
    "rol",
    ...PERSONAL_FIELDS.map((field) => selectField(columns, field)),
    ...PROFESSIONAL_FIELDS.map((field) => selectField(columns, field)),
  ];

  const [rows] = await query(
    `SELECT ${selectFields.join(", ")} FROM usuarios WHERE id = ? LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

router.use(requireAuth);

// Devuelve siempre el perfil del usuario autenticado, nunca perfiles ajenos.
router.get("/", async (req, res) => {
  try {
    const profile = await fetchProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ ok: false, message: "Perfil no encontrado" });
    }

    res.json({ ok: true, profile });
  } catch (e) {
    console.error("Error GET /api/perfil:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Actualiza solo campos personales permitidos; el rol nunca se acepta desde el perfil.
router.put("/", async (req, res) => {
  try {
    const payload = { ...req.body };
    const validationError = validatePersonalPayload(payload);
    if (validationError) {
      return res.status(400).json({ ok: false, message: validationError });
    }

    const notificationPayload = buildNotificationPreferencePayload(payload);
    if (notificationPayload?.error) {
      return res.status(400).json({ ok: false, message: notificationPayload.error });
    }

    const columns = await getTableColumns("usuarios");
    const { fields, values } = pickWritableFields(payload, PERSONAL_FIELDS, columns);

    if (!fields.length && !notificationPayload?.preferences) {
      return res.status(400).json({ ok: false, message: "No hay campos validos para actualizar" });
    }

    if (fields.includes("email")) {
      const [existing] = await query(
        "SELECT id FROM usuarios WHERE email = ? AND id != ? LIMIT 1",
        [payload.email, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ ok: false, message: "Ya existe otro usuario con ese email" });
      }
    }

    if (fields.length) {
      await query(
        `UPDATE usuarios SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
        [...values, req.user.id]
      );
    }

    if (notificationPayload?.preferences) {
      await updateNotificationPreferences(req.user.id, notificationPayload.preferences);
    }

    const profile = await fetchProfile(req.user.id);
    res.json({ ok: true, message: "Perfil actualizado", profile });
  } catch (e) {
    console.error("Error PUT /api/perfil:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Perfil profesional visible y editable solo para profesorado y administracion.
router.put("/profesional", requireRoles(PROFESSIONAL_ROLES), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      tiene_club_propio: normalizeBoolean(req.body.tiene_club_propio),
    };

    if (payload.anos_experiencia !== undefined && payload.anos_experiencia !== null && payload.anos_experiencia !== "") {
      const years = Number(payload.anos_experiencia);
      if (!Number.isInteger(years) || years < 0 || years > 80) {
        return res.status(400).json({ ok: false, message: "Anos de experiencia no validos" });
      }
      payload.anos_experiencia = years;
    }

    const columns = await getTableColumns("usuarios");
    const { fields, values } = pickWritableFields(payload, PROFESSIONAL_FIELDS, columns);

    if (!fields.length) {
      return res.status(400).json({ ok: false, message: "No hay campos profesionales validos para actualizar" });
    }

    await query(
      `UPDATE usuarios SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...values, req.user.id]
    );

    const profile = await fetchProfile(req.user.id);
    res.json({ ok: true, message: "Perfil profesional actualizado", profile });
  } catch (e) {
    console.error("Error PUT /api/perfil/profesional:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// --- Cambio de contraseña ---------------------------------------------------
// Códigos: 400 datos no válidos, 403 contraseña actual incorrecta, 429 demasiados
// intentos. Nunca 401: el frontend cierra la sesión ante un 401 y aquí el usuario
// sigue identificado, solo se ha equivocado al escribir.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignora en silencio lo que pase de 72 bytes
const PASSWORD_BCRYPT_ROUNDS = 10;
const PASSWORD_MAX_FAILS = 5;
const PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const passwordFails = new Map(); // clave -> { count, resetAt }

function passwordKeys(req) {
  return [`u:${req.user?.id}`, `ip:${req.ip || req.socket?.remoteAddress || "?"}`];
}

function passwordBlockedSeconds(keys, now = Date.now()) {
  let wait = 0;
  for (const key of keys) {
    const entry = passwordFails.get(key);
    if (!entry) continue;
    if (entry.resetAt <= now) { passwordFails.delete(key); continue; }
    if (entry.count >= PASSWORD_MAX_FAILS) wait = Math.max(wait, Math.ceil((entry.resetAt - now) / 1000));
  }
  return wait;
}

function registerPasswordFail(keys, now = Date.now()) {
  for (const key of keys) {
    const entry = passwordFails.get(key);
    if (!entry || entry.resetAt <= now) passwordFails.set(key, { count: 1, resetAt: now + PASSWORD_WINDOW_MS });
    else entry.count += 1;
  }
}

export function resetPasswordAttempts() {
  passwordFails.clear();
}

// PUT /api/perfil/password  { actual, nueva }
router.put("/password", async (req, res) => {
  try {
    const { actual, nueva } = req.body || {};
    const keys = passwordKeys(req);

    const wait = passwordBlockedSeconds(keys);
    if (wait > 0) {
      res.set("Retry-After", String(wait));
      return res.status(429).json({
        ok: false,
        message: `Demasiados intentos fallidos. Espera ${Math.ceil(wait / 60)} minuto(s) y vuelve a probar.`,
      });
    }

    if (typeof actual !== "string" || typeof nueva !== "string" || !actual || !nueva) {
      return res.status(400).json({ ok: false, message: "Escribe tu contraseña actual y la nueva." });
    }
    if (nueva.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ ok: false, message: `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` });
    }
    if (Buffer.byteLength(nueva, "utf8") > PASSWORD_MAX_BYTES || Buffer.byteLength(actual, "utf8") > PASSWORD_MAX_BYTES) {
      return res.status(400).json({ ok: false, message: "La contraseña es demasiado larga. Usa como máximo 72 caracteres." });
    }

    const [rows] = await query("SELECT password_hash FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1", [req.user.id]);
    const hash = rows[0]?.password_hash;
    const valid = hash ? await bcrypt.compare(actual, hash) : false;
    if (!valid) {
      registerPasswordFail(keys);
      return res.status(403).json({ ok: false, message: "La contraseña actual no es correcta." });
    }

    if (nueva === actual) {
      return res.status(400).json({ ok: false, message: "La nueva contraseña debe ser distinta de la actual." });
    }

    const nuevoHash = await bcrypt.hash(nueva, PASSWORD_BCRYPT_ROUNDS);
    await query("UPDATE usuarios SET password_hash = ? WHERE id = ?", [nuevoHash, req.user.id]);
    passwordFails.delete(keys[0]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error PUT /api/perfil/password:", error.message);
    res.status(500).json({ ok: false, message: "No hemos podido cambiar la contraseña. Inténtalo de nuevo." });
  }
});

export default router;
