import express from "express";
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
    const alumnoGroupByEmail = alumnoColumns.has("email") ? ", a.email" : "";
    const alumnoGroupByTelefono = alumnoColumns.has("telefono") ? ", a.telefono" : "";

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

    const [alumnos] = await query(
      `SELECT
        a.id,
        a.nombre,
        a.apellidos,
        a.nivel,
        ${alumnoEmailSelect},
        ${alumnoTelefonoSelect},
        GROUP_CONCAT(DISTINCT g.id ORDER BY g.hora_inicio SEPARATOR ',') AS grupo_ids,
        GROUP_CONCAT(DISTINCT g.nombre ORDER BY g.hora_inicio SEPARATOR ' | ') AS grupos,
        GROUP_CONCAT(DISTINCT CONCAT_WS(' ', g.dia1, g.dia2, g.hora_inicio) ORDER BY g.hora_inicio SEPARATOR ' | ') AS horarios,
        GROUP_CONCAT(DISTINCT g.pista_habitual ORDER BY g.pista_habitual SEPARATOR ', ') AS pistas,
        GROUP_CONCAT(DISTINCT CONCAT(p.nombre, ' ', p.apellidos) ORDER BY p.nombre SEPARATOR ', ') AS profesores
       FROM alumnos a
       JOIN grupo_alumnos ga ON ga.alumno_id = a.id AND ga.activo = 1
       JOIN grupos g ON g.id = ga.grupo_id AND g.activo = 1 ${scopeWhere}
       LEFT JOIN profesores p ON p.id = g.profesor_id
       WHERE a.activo = 1
       GROUP BY a.id, a.nombre, a.apellidos, a.nivel${alumnoGroupByEmail}${alumnoGroupByTelefono}
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

    res.json({
      ok: true,
      scope: isAdmin ? "admin" : "profesor",
      alumnos,
      grupos,
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

export default router;
