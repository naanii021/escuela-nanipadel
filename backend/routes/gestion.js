import express from "express";
import bcrypt from "bcrypt";
import { db } from "../db/connection.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);
const STAFF_ROLES = ["admin", "profesor", "profe"];
const GESTION_SEDE = "Seminario Diocesano";

router.use(requireAuth);
router.use(requireRoles(STAFF_ROLES));

async function getTableColumns(tableName, executor = db.promise()) {
  const [rows] = await executor.query(`SHOW COLUMNS FROM ${tableName}`);
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

async function getGestionContext(executor = db.promise()) {
  const [rows] = await executor.query(
    `SELECT
      c.id AS curso_id,
      c.nombre AS curso_nombre,
      s.id AS sede_id,
      s.nombre AS sede_nombre
     FROM cursos_escolares c
     JOIN sedes s ON s.nombre = ?
     WHERE c.activo = 1
     ORDER BY c.id DESC
     LIMIT 1`,
    [GESTION_SEDE]
  );

  return rows[0] || null;
}

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function booleanFlag(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  return Number(value) === 1 || value === true ? 1 : 0;
}

function enrollmentActiveSelect(columns, alias = "ac") {
  if (columns.has("estado")) {
    return `CASE WHEN ${alias}.estado = 'baja' THEN 0 ELSE 1 END`;
  }
  return columns.has("activo") ? `COALESCE(${alias}.activo, 1)` : "1";
}

async function upsertCurrentEnrollment(connection, alumnoId, gestionContext, active, columns, groupId) {
  const [existing] = await connection.query(
    `SELECT *
     FROM alumno_curso
     WHERE alumno_id = ? AND curso_id = ? AND sede_id = ?
     LIMIT 1
     FOR UPDATE`,
    [alumnoId, gestionContext.curso_id, gestionContext.sede_id]
  );

  if (existing.length > 0) {
    const enrollmentActive = active === undefined
      ? (columns.has("estado") ? Number(existing[0].estado !== "baja") : booleanFlag(existing[0].activo, 1))
      : active;
    const updates = [];
    const values = [];

    if (active !== undefined && columns.has("activo")) {
      updates.push("activo = ?");
      values.push(active);
    }
    if (columns.has("estado") && (active !== undefined || groupId !== undefined)) {
      const state = !enrollmentActive
        ? "baja"
        : groupId !== undefined
          ? (groupId ? "grupo_asignado" : "pendiente_grupo")
          : existing[0].estado === "baja" ? "pendiente_grupo" : existing[0].estado;
      updates.push("estado = ?");
      values.push(state);
    }
    if (columns.has("fecha_baja") && active !== undefined) {
      updates.push(`fecha_baja = ${enrollmentActive ? "NULL" : "CURDATE()"}`);
    }
    if (updates.length) {
      await connection.query(
        `UPDATE alumno_curso SET ${updates.join(", ")} WHERE alumno_id = ? AND curso_id = ? AND sede_id = ?`,
        [...values, alumnoId, gestionContext.curso_id, gestionContext.sede_id]
      );
    }
    return enrollmentActive;
  }

  const enrollmentActive = active === undefined ? 1 : active;
  const payload = {
    alumno_id: alumnoId,
    curso_id: gestionContext.curso_id,
    sede_id: gestionContext.sede_id,
    activo: enrollmentActive,
    estado: enrollmentActive ? (groupId ? "grupo_asignado" : "pendiente_grupo") : "baja",
  };
  const { fields, values } = pickWritableFields(
    payload,
    ["alumno_id", "curso_id", "sede_id", "activo", "estado"],
    columns
  );

  if (!enrollmentActive && columns.has("fecha_baja")) fields.push("fecha_baja");

  await connection.query(
    `INSERT INTO alumno_curso (${fields.join(", ")}) VALUES (${fields.map((field) => field === "fecha_baja" ? "CURDATE()" : "?").join(", ")})`,
    values
  );

  return enrollmentActive;
}

async function replaceCurrentGroupAssignment(connection, alumnoId, gestionContext, assignment, columns) {
  let group = null;

  if (assignment.grupoId) {
    const [groups] = await connection.query(
      `SELECT id, dia1, dia2
       FROM grupos
       WHERE id = ? AND curso_id = ? AND sede_id = ? AND activo = 1
       LIMIT 1
       FOR UPDATE`,
      [assignment.grupoId, gestionContext.curso_id, gestionContext.sede_id]
    );

    group = groups[0];
    if (!group) {
      throw requestError(400, "El grupo seleccionado no pertenece al curso y sede activos");
    }
  }

  if (columns.has("activo")) {
    await connection.query(
      `UPDATE grupo_alumnos ga
       JOIN grupos g ON g.id = ga.grupo_id
       SET ga.activo = 0
       WHERE ga.alumno_id = ? AND g.curso_id = ? AND g.sede_id = ?`,
      [alumnoId, gestionContext.curso_id, gestionContext.sede_id]
    );
  } else {
    await connection.query(
      `DELETE ga
       FROM grupo_alumnos ga
       JOIN grupos g ON g.id = ga.grupo_id
       WHERE ga.alumno_id = ? AND g.curso_id = ? AND g.sede_id = ?`,
      [alumnoId, gestionContext.curso_id, gestionContext.sede_id]
    );
  }

  if (!group) return null;

  const asisteDia1 = group.dia1 ? booleanFlag(assignment.asisteDia1, 1) : 0;
  const asisteDia2 = group.dia2 ? booleanFlag(assignment.asisteDia2, 1) : 0;

  if (!asisteDia1 && !asisteDia2) {
    throw requestError(400, "Selecciona al menos un dia de asistencia para el grupo");
  }

  const [existing] = await connection.query(
    "SELECT * FROM grupo_alumnos WHERE grupo_id = ? AND alumno_id = ? LIMIT 1 FOR UPDATE",
    [group.id, alumnoId]
  );
  const payload = {
    grupo_id: group.id,
    alumno_id: alumnoId,
    activo: 1,
    asiste_dia1: asisteDia1,
    asiste_dia2: asisteDia2,
  };

  if (existing.length > 0) {
    const { fields, values } = pickWritableFields(
      payload,
      ["activo", "asiste_dia1", "asiste_dia2"],
      columns
    );
    if (fields.length) {
      await connection.query(
        `UPDATE grupo_alumnos SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE grupo_id = ? AND alumno_id = ?`,
        [...values, group.id, alumnoId]
      );
    }
  } else {
    const { fields, values } = pickWritableFields(
      payload,
      ["grupo_id", "alumno_id", "activo", "asiste_dia1", "asiste_dia2"],
      columns
    );
    await connection.query(
      `INSERT INTO grupo_alumnos (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      values
    );
  }

  return { grupoId: group.id, asisteDia1, asisteDia2 };
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
        curso_id: row.curso_id,
        sede_id: row.sede_id,
        deporte: row.deporte,
        categoria: row.categoria,
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
        nivel_juego: row.alumno_nivel_juego,
        email: row.alumno_email,
        telefono: row.alumno_telefono,
        asiste_dia1: row.asiste_dia1,
        asiste_dia2: row.asiste_dia2,
      });
    }
  });

  return Array.from(groups.values());
}

router.get("/resumen", async (req, res) => {
  try {
    const profesorId = await getProfesorIdForUser(req.user);
    const isAdmin = String(req.user.rol).toLowerCase() === "admin";
    const gestionContext = await getGestionContext();

    if (!gestionContext) {
      return res.status(404).json({
        ok: false,
        message: `No hay un curso activo para la sede ${GESTION_SEDE}`,
      });
    }

    const { curso_id: cursoId, sede_id: sedeId } = gestionContext;
    const alumnoColumns = await getTableColumns("alumnos");
    const alumnoCursoColumns = await getTableColumns("alumno_curso");
    const alumnoEmailSelect = alumnoColumns.has("email") ? "a.email" : "NULL AS email";
    const alumnoTelefonoSelect = alumnoColumns.has("telefono") ? "a.telefono" : "NULL AS telefono";
    const alumnoActivoSelect = alumnoColumns.has("activo") ? "a.activo" : "1 AS activo";
    const alumnoUsuarioSelect = alumnoColumns.has("usuario_id") ? "a.usuario_id" : "NULL AS usuario_id";
    const alumnoNivelJuegoSelect = alumnoColumns.has("nivel_juego") ? "a.nivel_juego" : "NULL AS nivel_juego";
    const alumnoObservacionesSelect = alumnoColumns.has("observaciones") ? "a.observaciones" : "NULL AS observaciones";
    const matriculaActivaSelect = `${enrollmentActiveSelect(alumnoCursoColumns)} AS matricula_activa`;
    const alumnoGroupByEmail = alumnoColumns.has("email") ? ", a.email" : "";
    const alumnoGroupByTelefono = alumnoColumns.has("telefono") ? ", a.telefono" : "";
    const alumnoGroupByActivo = alumnoColumns.has("activo") ? ", a.activo" : "";
    const alumnoGroupByUsuario = alumnoColumns.has("usuario_id") ? ", a.usuario_id" : "";
    const alumnoGroupByNivelJuego = alumnoColumns.has("nivel_juego") ? ", a.nivel_juego" : "";
    const alumnoGroupByObservaciones = alumnoColumns.has("observaciones") ? ", a.observaciones" : "";
    const alumnoGroupByMatriculaActiva = alumnoCursoColumns.has("estado")
      ? ", ac.estado"
      : alumnoCursoColumns.has("activo") ? ", ac.activo" : "";

    if (!isAdmin && !profesorId) {
      return res.json({
        ok: true,
        scope: "profesor",
        curso: { id: cursoId, nombre: gestionContext.curso_nombre },
        sede: { id: sedeId, nombre: gestionContext.sede_nombre },
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
        ${alumnoNivelJuegoSelect},
        ${alumnoObservacionesSelect},
        ${matriculaActivaSelect},
        GROUP_CONCAT(DISTINCT g.id ORDER BY g.hora_inicio SEPARATOR ',') AS grupo_ids,
        GROUP_CONCAT(DISTINCT g.nombre ORDER BY g.hora_inicio SEPARATOR ' | ') AS grupos,
        GROUP_CONCAT(
          DISTINCT CONCAT_WS(
            ' ',
            IF(COALESCE(ga.asiste_dia1, 1) = 1, g.dia1, NULL),
            IF(COALESCE(ga.asiste_dia2, IF(g.dia2 IS NULL, 0, 1)) = 1, g.dia2, NULL),
            g.hora_inicio
          )
          ORDER BY g.hora_inicio SEPARATOR ' | '
        ) AS horarios,
        GROUP_CONCAT(DISTINCT g.pista_habitual ORDER BY g.pista_habitual SEPARATOR ', ') AS pistas,
        GROUP_CONCAT(DISTINCT CONCAT(p.nombre, ' ', p.apellidos) ORDER BY p.nombre SEPARATOR ', ') AS profesores
       FROM alumnos a
       JOIN alumno_curso ac
         ON ac.alumno_id = a.id
        AND ac.curso_id = ?
        AND ac.sede_id = ?
       ${alumnoJoinType} grupo_alumnos ga ON ga.alumno_id = a.id AND ga.activo = 1
       ${alumnoJoinType} grupos g
         ON g.id = ga.grupo_id
        AND g.activo = 1
        AND g.curso_id = ac.curso_id
        AND g.sede_id = ac.sede_id
        ${scopeWhere}
       LEFT JOIN profesores p ON p.id = g.profesor_id
       WHERE ${alumnoColumns.has("activo") ? "a.activo = 1" : "1 = 1"}
       GROUP BY a.id, a.nombre, a.apellidos, a.nivel${alumnoGroupByEmail}${alumnoGroupByTelefono}${alumnoGroupByActivo}${alumnoGroupByUsuario}${alumnoGroupByNivelJuego}${alumnoGroupByObservaciones}${alumnoGroupByMatriculaActiva}
       ORDER BY a.apellidos, a.nombre`,
      [cursoId, sedeId, ...scopeParams]
    );

    const [groupRows] = await query(
      `SELECT DISTINCT
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
        g.curso_id,
        g.sede_id,
        g.deporte,
        g.categoria,
        g.profesor_id,
        CONCAT(p.nombre, ' ', p.apellidos) AS profesor,
        a.id AS alumno_id,
        a.nombre AS alumno_nombre,
        a.apellidos AS alumno_apellidos,
        a.nivel AS alumno_nivel,
        ${alumnoColumns.has("nivel_juego") ? "a.nivel_juego" : "NULL"} AS alumno_nivel_juego,
        ${alumnoColumns.has("email") ? "a.email" : "NULL"} AS alumno_email,
        ${alumnoColumns.has("telefono") ? "a.telefono" : "NULL"} AS alumno_telefono,
        ga.asiste_dia1,
        ga.asiste_dia2
       FROM grupos g
       LEFT JOIN profesores p ON p.id = g.profesor_id
       LEFT JOIN grupo_alumnos ga ON ga.grupo_id = g.id AND ga.activo = 1
       LEFT JOIN alumno_curso ac
         ON ac.alumno_id = ga.alumno_id
        AND ac.curso_id = g.curso_id
        AND ac.sede_id = g.sede_id
        ${alumnoCursoColumns.has("estado") ? "AND ac.estado <> 'baja'" : alumnoCursoColumns.has("activo") ? "AND ac.activo = 1" : ""}
       LEFT JOIN alumnos a ON a.id = ac.alumno_id AND a.activo = 1
       WHERE g.activo = 1
         AND g.curso_id = ?
         AND g.sede_id = ?
         ${isAdmin ? "" : "AND g.profesor_id = ?"}
       ORDER BY g.hora_inicio, g.codigo, a.apellidos, a.nombre`,
      [cursoId, sedeId, ...scopeParams]
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
      `SELECT DISTINCT
        a.id,
        a.nombre,
        a.apellidos,
        a.nivel,
        ${buildSelect("a", alumnoColumns, "nivel_juego")},
        ${buildSelect("a", alumnoColumns, "email")},
        ${buildSelect("a", alumnoColumns, "telefono")},
        ${buildSelect("a", alumnoColumns, "observaciones")},
        ${alumnoColumns.has("activo") ? "a.activo" : "1 AS activo"},
        ${matriculaActivaSelect},
        ${buildSelect("a", alumnoColumns, "usuario_id")}
       FROM alumnos a
       JOIN alumno_curso ac
         ON ac.alumno_id = a.id
        AND ac.curso_id = ?
        AND ac.sede_id = ?
       WHERE ${alumnoColumns.has("activo") ? "a.activo = 1" : "1 = 1"}
       ORDER BY a.apellidos, a.nombre`,
      [cursoId, sedeId]
    );

    res.json({
      ok: true,
      scope: isAdmin ? "admin" : "profesor",
      curso: { id: cursoId, nombre: gestionContext.curso_nombre },
      sede: { id: sedeId, nombre: gestionContext.sede_nombre },
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

router.get("/usuarios", async (req, res) => {
  try {
    const roleFilter = String(req.query.rol || req.query.role || "").toLowerCase();
    const search = String(req.query.search || "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const where = ["COALESCE(u.activo, 1) = 1"];
    const params = [];

    if (roleFilter === "alumno" || roleFilter === "alumnos") {
      where.push("(u.rol IN ('alumno', 'usuario') OR a.id IS NOT NULL)");
    } else if (roleFilter === "profesor" || roleFilter === "profesores") {
      where.push("u.rol IN ('profesor', 'profe')");
    }

    if (search) {
      where.push(`(
        u.nombre LIKE ? OR
        u.apellidos LIKE ? OR
        u.email LIKE ? OR
        COALESCE(grupos_alumno.grupos, '') LIKE ?
      )`);
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const [rows] = await query(
      `SELECT
        u.id,
        u.nombre,
        u.apellidos,
        u.email,
        u.rol,
        a.id AS alumno_id,
        COALESCE(grupos_alumno.grupos, '') AS grupos
       FROM usuarios u
       LEFT JOIN alumnos a ON a.usuario_id = u.id
       LEFT JOIN (
         SELECT
           a2.usuario_id,
           GROUP_CONCAT(DISTINCT g.nombre ORDER BY g.hora_inicio SEPARATOR ' | ') AS grupos
         FROM alumnos a2
         LEFT JOIN grupo_alumnos ga ON ga.alumno_id = a2.id AND COALESCE(ga.activo, 1) = 1
         LEFT JOIN grupos g ON g.id = ga.grupo_id AND COALESCE(g.activo, 1) = 1
         WHERE a2.usuario_id IS NOT NULL
         GROUP BY a2.usuario_id
       ) grupos_alumno ON grupos_alumno.usuario_id = u.id
       WHERE ${where.join(" AND ")}
       GROUP BY u.id, u.nombre, u.apellidos, u.email, u.rol, a.id, grupos_alumno.grupos
       ORDER BY u.nombre, u.apellidos
       LIMIT ?`,
      [...params, limit]
    );

    res.json({ ok: true, usuarios: rows });
  } catch (e) {
    console.error("Error GET /api/gestion/usuarios:", e);
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
  let connection;

  try {
    const alumnoId = req.body.alumno_id;

    if (!alumnoId) {
      return res.status(400).json({ ok: false, message: "Selecciona un alumno" });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const gestionContext = await getGestionContext(connection);
    if (!gestionContext) {
      throw requestError(409, `No hay un curso activo para la sede ${GESTION_SEDE}`);
    }

    const alumnoCursoColumns = await getTableColumns("alumno_curso", connection);
    const grupoAlumnoColumns = await getTableColumns("grupo_alumnos", connection);
    const enrollmentActiveWhere = alumnoCursoColumns.has("estado")
      ? "AND estado <> 'baja'"
      : alumnoCursoColumns.has("activo") ? "AND activo = 1" : "";
    const [enrollments] = await connection.query(
      `SELECT alumno_id
       FROM alumno_curso
       WHERE alumno_id = ? AND curso_id = ? AND sede_id = ? ${enrollmentActiveWhere}
       LIMIT 1
       FOR UPDATE`,
      [alumnoId, gestionContext.curso_id, gestionContext.sede_id]
    );

    if (!enrollments.length) {
      throw requestError(400, "El alumno no tiene una matricula activa en el curso y sede actuales");
    }

    const assignment = await replaceCurrentGroupAssignment(
      connection,
      alumnoId,
      gestionContext,
      {
        grupoId: req.params.id,
        asisteDia1: req.body.asiste_dia1,
        asisteDia2: req.body.asiste_dia2,
      },
      grupoAlumnoColumns
    );

    await upsertCurrentEnrollment(
      connection, alumnoId, gestionContext, undefined, alumnoCursoColumns, assignment.grupoId
    );

    await connection.commit();

    res.status(201).json({
      ok: true,
      grupo_id: assignment.grupoId,
      asiste_dia1: assignment.asisteDia1,
      asiste_dia2: assignment.asisteDia2,
      message: "Alumno anadido al grupo",
    });
  } catch (e) {
    if (connection) await connection.rollback();
    console.error("Error POST /api/gestion/grupos/:id/alumnos:", e);
    res.status(e.status || 500).json({ ok: false, message: e.message });
  } finally {
    connection?.release();
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
  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const gestionContext = await getGestionContext(connection);
    if (!gestionContext) {
      throw requestError(409, `No hay un curso activo para la sede ${GESTION_SEDE}`);
    }

    const alumnoColumns = await getTableColumns("alumnos", connection);
    const alumnoCursoColumns = await getTableColumns("alumno_curso", connection);
    const grupoAlumnoColumns = await getTableColumns("grupo_alumnos", connection);
    const payload = {
      nombre: req.body.nombre?.trim(),
      apellidos: req.body.apellidos?.trim() || null,
      nivel: req.body.nivel || null,
      nivel_juego: req.body.nivel_juego ?? null,
      telefono: req.body.telefono?.trim() || null,
      email: req.body.email?.trim() || null,
      activo: req.body.activo ?? 1,
      observaciones: req.body.observaciones?.trim() || null,
      usuario_id: null,
    };

    if (!payload.nombre) {
      throw requestError(400, "El nombre del alumno es obligatorio");
    }

    const allowed = ["nombre", "apellidos", "nivel", "nivel_juego", "telefono", "email", "activo", "observaciones", "usuario_id"];
    const { fields, values } = pickWritableFields(payload, allowed, alumnoColumns);

    const [result] = await connection.query(
      `INSERT INTO alumnos (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      values
    );

    const matriculaActiva = booleanFlag(req.body.matricula_activa, 1);
    if (!matriculaActiva && req.body.grupo_id) {
      throw requestError(400, "Una matricula inactiva no puede tener un grupo asignado");
    }

    await upsertCurrentEnrollment(
      connection,
      result.insertId,
      gestionContext,
      matriculaActiva,
      alumnoCursoColumns,
      matriculaActiva ? req.body.grupo_id || null : null
    );

    const assignment = await replaceCurrentGroupAssignment(
      connection,
      result.insertId,
      gestionContext,
      {
        grupoId: matriculaActiva ? req.body.grupo_id || null : null,
        asisteDia1: req.body.asiste_dia1,
        asisteDia2: req.body.asiste_dia2,
      },
      grupoAlumnoColumns
    );

    await connection.commit();

    res.status(201).json({
      ok: true,
      id: result.insertId,
      curso_id: gestionContext.curso_id,
      sede_id: gestionContext.sede_id,
      grupo_id: assignment?.grupoId || null,
      message: "Alumno creado correctamente",
    });
  } catch (e) {
    if (connection) await connection.rollback();
    console.error("Error POST /api/gestion/alumnos:", e);
    res.status(e.status || 500).json({ ok: false, message: e.message });
  } finally {
    connection?.release();
  }
});

router.put("/alumnos/:id", requireAdmin, async (req, res) => {
  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const gestionContext = await getGestionContext(connection);
    if (!gestionContext) {
      throw requestError(409, `No hay un curso activo para la sede ${GESTION_SEDE}`);
    }

    const alumnoColumns = await getTableColumns("alumnos", connection);
    const alumnoCursoColumns = await getTableColumns("alumno_curso", connection);
    const grupoAlumnoColumns = await getTableColumns("grupo_alumnos", connection);
    const usuarioColumns = alumnoColumns.has("usuario_id")
      ? await getTableColumns("usuarios", connection)
      : new Set();
    const hasOwn = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
    const personalPayload = {};

    if (hasOwn("nombre")) personalPayload.nombre = req.body.nombre?.trim();
    if (hasOwn("apellidos")) personalPayload.apellidos = req.body.apellidos?.trim() || null;
    if (hasOwn("nivel")) personalPayload.nivel = req.body.nivel || null;
    if (hasOwn("nivel_juego")) personalPayload.nivel_juego = req.body.nivel_juego === "" ? null : req.body.nivel_juego;
    if (hasOwn("telefono")) personalPayload.telefono = req.body.telefono?.trim() || null;
    if (hasOwn("email")) personalPayload.email = req.body.email?.trim() || null;
    if (hasOwn("activo")) personalPayload.activo = req.body.activo;
    if (hasOwn("observaciones")) personalPayload.observaciones = req.body.observaciones?.trim() || null;

    if (hasOwn("nombre") && !personalPayload.nombre) {
      throw requestError(400, "El nombre del alumno es obligatorio");
    }

    const allowed = ["nombre", "apellidos", "nivel", "nivel_juego", "telefono", "email", "activo", "observaciones"];
    const { fields, values } = pickWritableFields(personalPayload, allowed, alumnoColumns);
    const editsEnrollment = hasOwn("matricula_activa");
    const editsAssignment = hasOwn("grupo_id") || hasOwn("asiste_dia1") || hasOwn("asiste_dia2");

    if (!fields.length && !editsEnrollment && !editsAssignment) {
      throw requestError(400, "No hay campos validos para actualizar");
    }

    if ((hasOwn("asiste_dia1") || hasOwn("asiste_dia2")) && !hasOwn("grupo_id")) {
      throw requestError(400, "Indica el grupo para actualizar sus dias de asistencia");
    }

    const usuarioIdSelect = alumnoColumns.has("usuario_id") ? ", usuario_id" : "";
    const [students] = await connection.query(
      `SELECT id${usuarioIdSelect} FROM alumnos WHERE id = ? LIMIT 1 FOR UPDATE`,
      [req.params.id]
    );

    if (!students.length) {
      throw requestError(404, "Alumno no encontrado");
    }

    if (fields.length) {
      await connection.query(
        `UPDATE alumnos SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
        [...values, req.params.id]
      );
    }

    const requestedEnrollmentActive = editsEnrollment
      ? booleanFlag(req.body.matricula_activa, 1)
      : undefined;
    const enrollmentActive = await upsertCurrentEnrollment(
      connection,
      req.params.id,
      gestionContext,
      requestedEnrollmentActive,
      alumnoCursoColumns,
      editsAssignment ? req.body.grupo_id || null : undefined
    );

    let assignment = null;
    if (editsAssignment || enrollmentActive === 0) {
      if (enrollmentActive === 0 && req.body.grupo_id) {
        throw requestError(400, "Una matricula inactiva no puede tener un grupo asignado");
      }

      assignment = await replaceCurrentGroupAssignment(
        connection,
        req.params.id,
        gestionContext,
        {
          grupoId: enrollmentActive ? req.body.grupo_id || null : null,
          asisteDia1: req.body.asiste_dia1,
          asisteDia2: req.body.asiste_dia2,
        },
        grupoAlumnoColumns
      );
    }

    if (fields.includes("nivel_juego") && usuarioColumns.has("nivel_juego") && students[0].usuario_id) {
      await connection.query("UPDATE usuarios SET nivel_juego = ? WHERE id = ?", [
        personalPayload.nivel_juego,
        students[0].usuario_id,
      ]);
    }

    await connection.commit();

    res.json({
      ok: true,
      curso_id: gestionContext.curso_id,
      sede_id: gestionContext.sede_id,
      grupo_id: editsAssignment ? assignment?.grupoId || null : undefined,
      message: "Alumno actualizado correctamente",
    });
  } catch (e) {
    if (connection) await connection.rollback();
    console.error("Error PUT /api/gestion/alumnos/:id:", e);
    res.status(e.status || 500).json({ ok: false, message: e.message });
  } finally {
    connection?.release();
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
      return res.status(400).json({ ok: false, message: "Email y contraseña son obligatorios" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, message: "La contraseña debe tener al menos 6 caracteres" });
    }

    await connection.beginTransaction();

    const [alumnos] = await connection.query(
      `SELECT id, nombre, apellidos, usuario_id${alumnoColumns.has("nivel_juego") ? ", nivel_juego" : ""}
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
      nivel_juego: alumno.nivel_juego ?? null,
    };

    const { fields, values } = pickWritableFields(
      payload,
      ["nombre", "email", "telefono", "password_hash", "rol", "activo", "nivel_juego"],
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
