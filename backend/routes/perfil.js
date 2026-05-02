import express from "express";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

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

    const columns = await getTableColumns("usuarios");
    const { fields, values } = pickWritableFields(payload, PERSONAL_FIELDS, columns);

    if (!fields.length) {
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

    await query(
      `UPDATE usuarios SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...values, req.user.id]
    );

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

export default router;
