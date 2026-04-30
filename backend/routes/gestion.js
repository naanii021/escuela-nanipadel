import express from "express";
import bcrypt from "bcrypt";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);
const STAFF_ROLES = ["admin", "profesor", "profe"];

router.use(requireAuth);
router.use(requireRoles(STAFF_ROLES));

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

function isAdmin(req) {
  return String(req.user?.rol || "").toLowerCase() === "admin";
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).type("application/json").json({
      ok: false,
      message: "Solo administracion puede modificar la gestion de escuela",
    });
  }

  next();
}

function pickWritableFields(payload, allowedFields, tableColumns) {
  const fields = [];
  const values = [];

  allowedFields.forEach((field) => {
    if (tableColumns.has(field) && Object.prototype.hasOwnProperty.call(payload, field)) {
      fields.push(field);
      values.push(payload[field] === "" ? null : payload[field]);
    }
  });

  return { fields, values };
}

function buildSelect(tableAlias, columns, field) {
  return columns.has(field) ? `${tableAlias}.${field}` : `NULL AS ${field}`;
}

async function getProfesorIdForUser(user) {
  const role = String(user?.rol || "").toLowerCase();

  if (role === "admin") return null;

  const columns = await getTableColumns("profesores");
  const conditions = [];
  const params = [];

  if (columns.has("usuario_id")) {
    conditions.push("usuario_id = ?");
    params.push(user.id);
  }

  if (columns.has("email") && user.email) {
    conditions.push("email = ?");
    params.push(user.email);
  }

  conditions.push("id = ?");
  params.push(user.id);

  if (!conditions.length) return 0;

  const [rows] = await query(
    `SELECT id FROM profesores WHERE ${conditions.join(" OR ")} LIMIT 1`,
    params
  );

  return rows[0]?.id || 0;
}

function parseGroupRows(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    if (!groups.has(row.id)) {
      groups.set(row.id, {
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        nivel: row.nivel,
        dia1: row.dia1,
        dia2: row.dia2,
        hora_inicio: row.hora_inicio,
        duracion_min: row.duracion_min,
        pista_habitual: row.pista_habitual,
        cupo: row.cupo,
        activo: row.activo,
        profesor_id: row.profesor_id,
        profesor: row.profesor,
        alumnos: [],
      });
    }

    if (row.alumno_id) {
      groups.get(row.id).alumnos.push({
        id: row.alumno_id,
        nombre: row.alumno_nombre,
        apellidos: row.alumno_apellidos,
        nivel: row.alumno_nivel,
        email: row.alumno_email,
        telefono: row.alumno_telefono,
      });
    }
  });

  return Array.from(groups.values());
}

router.get("/resumen", async (req, res) => {
  try {
    const profesorId = await getProfesorIdForUser(req.user);
    const isAdmin = String(req.user.rol).toLowerCase() === "admin";
    const alumnoColumns = await getTableColumns("alumnos");
    const alumnoEmailSelect = alumnoColumns.has("email") ? "a.email" : "NULL AS email";
    const alumnoTelefonoSelect = alumnoColumns.has("telefono") ? "a.telefono" : "NULL AS telefono";
    const alumnoActivoSelect = alumnoColumns.has("activo") ? "a.activo" : "1 AS activo";
    const alumnoUsuarioSelect = alumnoColumns.has("usuario_id") ? "a.usuario_id" : "NULL AS usuario_id";
    const alumnoGroupByEmail = alumnoColumns.has("email") ? ", a.email" : "";
    const alumnoGroupByTelefono = alumnoColumns.has("telefono") ? ", a.telefono" : "";
    const alumnoGroupByActivo = alumnoColumns.has("activo") ? ", a.activo" : "";
    const alumnoGroupByUsuario = alumnoColumns.has("usuario_id") ? ", a.usuario_id" : "";

    if (!isAdmin && !profesorId) {
      return res.json({
        ok: true,
        scope: "profesor",
        alumnos: [],
        grupos: [],
        stats: { totalAlumnos: 0, totalGrupos: 0, gruposActivos: 0 },
        message: "No hay un profesor vinculado a este usuario",
      });
    }

    const scopeWhere = isAdmin ? "" : "AND g.profesor_id = ?";
    const scopeParams = isAdmin ? [] : [profesorId];
    const alumnoJoinType = isAdmin ? "LEFT JOIN" : "JOIN";

    const [alumnos] = await query(
      `SELECT
        a.id,
        a.nombre,
        a.apellidos,
        a.nivel,
        ${alumnoEmailSelect},
        ${alumnoTelefonoSelect},
        ${alumnoActivoSelect},
        ${alumnoUsuarioSelect},
        GROUP_CONCAT(DISTINCT g.id ORDER BY g.hora_inicio SEPARATOR ',') AS grupo_ids,
        GROUP_CONCAT(DISTINCT g.nombre ORDER BY g.hora_inicio SEPARATOR ' | ') AS grupos,
        GROUP_CONCAT(DISTINCT CONCAT_WS(' ', g.dia1, g.dia2, g.hora_inicio) ORDER BY g.hora_inicio SEPARATOR ' | ') AS horarios,
        GROUP_CONCAT(DISTINCT g.pista_habitual ORDER BY g.pista_habitual SEPARATOR ', ') AS pistas,
        GROUP_CONCAT(DISTINCT CONCAT(p.nombre, ' ', p.apellidos) ORDER BY p.nombre SEPARATOR ', ') AS profesores
       FROM alumnos a
       ${alumnoJoinType} grupo_alumnos ga ON ga.alumno_id = a.id AND ga.activo = 1
       ${alumnoJoinType} grupos g ON g.id = ga.grupo_id AND g.activo = 1 ${scopeWhere}
       LEFT JOIN profesores p ON p.id = g.profesor_id
       WHERE ${alumnoColumns.has("activo") ? "a.activo = 1" : "1 = 1"}
       GROUP BY a.id, a.nombre, a.apellidos, a.nivel${alumnoGroupByEmail}${alumnoGroupByTelefono}${alumnoGroupByActivo}${alumnoGroupByUsuario}
       ORDER BY a.apellidos, a.nombre`,
      scopeParams
    );

    const [groupRows] = await query(
      `SELECT
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
        a.id AS alumno_id,
        a.nombre AS alumno_nombre,
        a.apellidos AS alumno_apellidos,
        a.nivel AS alumno_nivel,
        ${alumnoColumns.has("email") ? "a.email" : "NULL"} AS alumno_email,
        ${alumnoColumns.has("telefono") ? "a.telefono" : "NULL"} AS alumno_telefono
       FROM grupos g
       LEFT JOIN profesores p ON p.id = g.profesor_id
       LEFT JOIN grupo_alumnos ga ON ga.grupo_id = g.id AND ga.activo = 1
       LEFT JOIN alumnos a ON a.id = ga.alumno_id AND a.activo = 1
       WHERE g.activo = 1 ${isAdmin ? "" : "AND g.profesor_id = ?"}
       ORDER BY g.hora_inicio, g.codigo, a.apellidos, a.nombre`,
      scopeParams
    );

    const grupos = parseGroupRows(groupRows);
    const [profesores] = await query(
      `SELECT id, nombre, apellidos, CONCAT(nombre, ' ', apellidos) AS nombre_completo
       FROM profesores
       ORDER BY nombre, apellidos`
    );

    const [pistas] = await query(
      `SELECT id, nombre
       FROM pistas
       WHERE ${await getTableColumns("pistas").then((columns) => columns.has("activa") ? "activa = 1" : "1 = 1")}
       ORDER BY id`
    );

    const [todosAlumnos] = await query(
      `SELECT
        a.id,
        a.nombre,
        a.apellidos,
        a.nivel,
        ${buildSelect("a", alumnoColumns, "email")},
        ${buildSelect("a", alumnoColumns, "telefono")},
        ${alumnoColumns.has("activo") ? "a.activo" : "1 AS activo"},
        ${buildSelect("a", alumnoColumns, "usuario_id")}
       FROM alumnos a
       WHERE ${alumnoColumns.has("activo") ? "a.activo = 1" : "1 = 1"}
       ORDER BY a.apellidos, a.nombre`
    );

    res.json({
      ok: true,
      scope: isAdmin ? "admin" : "profesor",
      alumnos,
      grupos,
      catalogos: {
        profesores,
        pistas,
        alumnos: isAdmin ? todosAlumnos : alumnos,
      },
      stats: {
        totalAlumnos: alumnos.length,
        totalGrupos: grupos.length,
        gruposActivos: grupos.filter((grupo) => Number(grupo.activo) === 1).length,
      },
    });
  } catch (e) {
    console.error("Error GET /api/gestion/resumen:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/grupos", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("grupos");
    const payload = {
      codigo: req.body.codigo?.trim() || null,
      nombre: req.body.nombre?.trim(),
      nivel: req.body.nivel || null,
      profesor_id: req.body.profesor_id || null,
      dia1: req.body.dia1 || null,
      dia2: req.body.dia2 || null,
      hora_inicio: req.body.hora_inicio || null,
      duracion_min: req.body.duracion_min || 60,
      pista_habitual: req.body.pista_habitual || null,
      cupo: req.body.cupo || null,
      activo: req.body.activo ?? 1,
    };

    if (!payload.nombre) {
      return res.status(400).json({ ok: false, message: "El nombre del grupo es obligatorio" });
    }

    const allowed = ["codigo", "nombre", "nivel", "profesor_id", "dia1", "dia2", "hora_inicio", "duracion_min", "pista_habitual", "cupo", "activo"];
    const { fields, values } = pickWritableFields(payload, allowed, columns);

    const placeholders = fields.map(() => "?").join(", ");
    const [result] = await query(
      `INSERT INTO grupos (${fields.join(", ")}) VALUES (${placeholders})`,
      values
    );

    res.status(201).json({ ok: true, id: result.insertId, message: "Grupo creado correctamente" });
  } catch (e) {
    console.error("Error POST /api/gestion/grupos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.put("/grupos/:id", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("grupos");
    const allowed = ["codigo", "nombre", "nivel", "profesor_id", "dia1", "dia2", "hora_inicio", "duracion_min", "pista_habitual", "cupo", "activo"];
    const { fields, values } = pickWritableFields(req.body, allowed, columns);

    if (!fields.length) {
      return res.status(400).json({ ok: false, message: "No hay campos validos para actualizar" });
    }

    await query(
      `UPDATE grupos SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...values, req.params.id]
    );

    res.json({ ok: true, message: "Grupo actualizado correctamente" });
  } catch (e) {
    console.error("Error PUT /api/gestion/grupos/:id:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.delete("/grupos/:id", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("grupos");

    if (columns.has("activo")) {
      await query("UPDATE grupos SET activo = 0 WHERE id = ?", [req.params.id]);
      return res.json({ ok: true, message: "Grupo desactivado correctamente" });
    }

    await query("DELETE FROM grupo_alumnos WHERE grupo_id = ?", [req.params.id]);
    await query("DELETE FROM grupos WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Grupo eliminado correctamente" });
  } catch (e) {
    console.error("Error DELETE /api/gestion/grupos/:id:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/grupos/:id/alumnos", requireAdmin, async (req, res) => {
  try {
    const alumnoId = req.body.alumno_id;

    if (!alumnoId) {
      return res.status(400).json({ ok: false, message: "Selecciona un alumno" });
    }

    const [existing] = await query(
      "SELECT * FROM grupo_alumnos WHERE grupo_id = ? AND alumno_id = ? LIMIT 1",
      [req.params.id, alumnoId]
    );

    if (existing.length > 0) {
      if (Object.prototype.hasOwnProperty.call(existing[0], "activo")) {
        await query("UPDATE grupo_alumnos SET activo = 1 WHERE grupo_id = ? AND alumno_id = ?", [req.params.id, alumnoId]);
      }

      return res.json({ ok: true, message: "Alumno ya vinculado al grupo" });
    }

    const columns = await getTableColumns("grupo_alumnos");
    const payload = { grupo_id: req.params.id, alumno_id: alumnoId, activo: 1 };
    const { fields, values } = pickWritableFields(payload, ["grupo_id", "alumno_id", "activo"], columns);

    await query(
      `INSERT INTO grupo_alumnos (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      values
    );

    res.status(201).json({ ok: true, message: "Alumno anadido al grupo" });
  } catch (e) {
    console.error("Error POST /api/gestion/grupos/:id/alumnos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.delete("/grupos/:id/alumnos/:alumnoId", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("grupo_alumnos");

    if (columns.has("activo")) {
      await query(
        "UPDATE grupo_alumnos SET activo = 0 WHERE grupo_id = ? AND alumno_id = ?",
        [req.params.id, req.params.alumnoId]
      );
    } else {
      await query(
        "DELETE FROM grupo_alumnos WHERE grupo_id = ? AND alumno_id = ?",
        [req.params.id, req.params.alumnoId]
      );
    }

    res.json({ ok: true, message: "Alumno quitado del grupo" });
  } catch (e) {
    console.error("Error DELETE /api/gestion/grupos/:id/alumnos/:alumnoId:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/alumnos", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("alumnos");
    const payload = {
      nombre: req.body.nombre?.trim(),
      apellidos: req.body.apellidos?.trim() || null,
      nivel: req.body.nivel || null,
      telefono: req.body.telefono?.trim() || null,
      email: req.body.email?.trim() || null,
      activo: req.body.activo ?? 1,
      observaciones: req.body.observaciones?.trim() || null,
      usuario_id: null,
    };

    if (!payload.nombre) {
      return res.status(400).json({ ok: false, message: "El nombre del alumno es obligatorio" });
    }

    const allowed = ["nombre", "apellidos", "nivel", "telefono", "email", "activo", "observaciones", "usuario_id"];
    const { fields, values } = pickWritableFields(payload, allowed, columns);

    const [result] = await query(
      `INSERT INTO alumnos (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      values
    );

    res.status(201).json({
      ok: true,
      id: result.insertId,
      message: "Alumno creado correctamente",
    });
  } catch (e) {
    console.error("Error POST /api/gestion/alumnos:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.put("/alumnos/:id", requireAdmin, async (req, res) => {
  try {
    const columns = await getTableColumns("alumnos");
    const allowed = ["nombre", "apellidos", "nivel", "telefono", "email", "activo"];
    const { fields, values } = pickWritableFields(req.body, allowed, columns);

    if (!fields.length) {
      return res.status(400).json({ ok: false, message: "No hay campos validos para actualizar" });
    }

    await query(
      `UPDATE alumnos SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
      [...values, req.params.id]
    );

    res.json({ ok: true, message: "Alumno actualizado correctamente" });
  } catch (e) {
    console.error("Error PUT /api/gestion/alumnos/:id:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/alumnos/:id/crear-acceso", requireAdmin, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const alumnoColumns = await getTableColumns("alumnos");
    const usuarioColumns = await getTableColumns("usuarios");

    if (!alumnoColumns.has("usuario_id")) {
      return res.status(400).json({
        ok: false,
        message: "La tabla alumnos no tiene usuario_id para enlazar cuentas",
      });
    }

    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "Email y contrasena son obligatorios" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, message: "La contrasena debe tener al menos 6 caracteres" });
    }

    await connection.beginTransaction();

    const [alumnos] = await connection.query(
      `SELECT id, nombre, apellidos, usuario_id
       FROM alumnos
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (alumnos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, message: "Alumno no encontrado" });
    }

    const alumno = alumnos[0];

    if (alumno.usuario_id) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Este alumno ya tiene acceso a la plataforma" });
    }

    const [existingUsers] = await connection.query(
      "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese email" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = `${alumno.nombre || ""} ${alumno.apellidos || ""}`.trim();
    const payload = {
      nombre: fullName || alumno.nombre,
      email,
      password_hash: passwordHash,
      rol: "alumno",
      activo: 1,
      telefono: req.body.telefono?.trim() || null,
    };

    const { fields, values } = pickWritableFields(
      payload,
      ["nombre", "email", "telefono", "password_hash", "rol", "activo"],
      usuarioColumns
    );

    const [userResult] = await connection.query(
      `INSERT INTO usuarios (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      values
    );

    await connection.query(
      "UPDATE alumnos SET usuario_id = ? WHERE id = ?",
      [userResult.insertId, req.params.id]
    );

    await connection.commit();

    res.status(201).json({
      ok: true,
      user_id: userResult.insertId,
      message: "Acceso creado y enlazado al alumno correctamente",
    });
  } catch (e) {
    await connection.rollback();
    console.error("Error POST /api/gestion/alumnos/:id/crear-acceso:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

export default router;
