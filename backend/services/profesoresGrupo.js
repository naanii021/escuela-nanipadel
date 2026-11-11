// Varios profesores por grupo ("clases compartidas").
//
// La tabla `grupo_profesores` (migración sql/2026-11-12_grupo_profesores.sql) es opcional: el código
// funciona igual antes y después de aplicarla.
//  - Sin tabla: el único profesor de un grupo es `grupos.profesor_id`.
//  - Con tabla: un profesor pertenece al grupo si está en la tabla O es `grupos.profesor_id`
//    (por seguridad ante datos a medias). `grupos.profesor_id` sigue siendo el profesor principal.

export const MAX_PROFESORES_GRUPO = 4;

let tablaPromise = null;

// La existencia de la tabla no cambia en caliente: se consulta una vez por proceso.
export function existeTablaGrupoProfesores(connection) {
  if (!tablaPromise) {
    tablaPromise = connection.query("SHOW TABLES LIKE 'grupo_profesores'")
      .then(([rows]) => rows.length > 0)
      .catch((error) => {
        tablaPromise = null;
        throw error;
      });
  }
  return tablaPromise;
}

export function resetGrupoProfesoresCache() {
  tablaPromise = null;
}

// Fragmento SQL "el grupo `alias` es del profesor X" con sus parámetros, para usar en un WHERE/ON.
export function condicionGruposDelProfesor(tieneTabla, profesorId, alias = "g") {
  if (!tieneTabla) return { sql: `${alias}.profesor_id = ?`, params: [profesorId] };
  const gp = `gp_${alias}`;
  return {
    sql: `(${alias}.profesor_id = ? OR EXISTS (SELECT 1 FROM grupo_profesores ${gp} WHERE ${gp}.grupo_id = ${alias}.id AND ${gp}.profesor_id = ?))`,
    params: [profesorId, profesorId],
  };
}

// Condición de JOIN para unir `profesores` (pAlias) con TODOS los profesores del grupo `alias`.
export function condicionJoinProfesoresDeGrupo(tieneTabla, alias = "g", pAlias = "p") {
  if (!tieneTabla) return `${pAlias}.id = ${alias}.profesor_id`;
  return `(${pAlias}.id = ${alias}.profesor_id OR ${pAlias}.id IN (SELECT gp_j.profesor_id FROM grupo_profesores gp_j WHERE gp_j.grupo_id = ${alias}.id))`;
}

// Map grupoId -> [{ id, nombre, apellidos }] con el principal primero.
export async function profesoresDeGrupos(connection, grupoIds) {
  const ids = [...new Set((grupoIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const mapa = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return mapa;
  const tiene = await existeTablaGrupoProfesores(connection);
  const [rows] = await connection.query(
    `SELECT g.id AS grupo_id, p.id, p.nombre, p.apellidos
     FROM grupos g
     JOIN profesores p ON ${condicionJoinProfesoresDeGrupo(tiene, "g", "p")}
     WHERE g.id IN (${ids.map(() => "?").join(", ")})
     ORDER BY g.id, (p.id = g.profesor_id) DESC, p.nombre, p.apellidos, p.id`,
    ids
  );
  for (const row of rows) {
    mapa.get(Number(row.grupo_id))?.push({ id: Number(row.id), nombre: row.nombre, apellidos: row.apellidos });
  }
  return mapa;
}

export async function profesoresDeGrupo(connection, grupoId) {
  return (await profesoresDeGrupos(connection, [grupoId])).get(Number(grupoId)) || [];
}

function nombreCompleto(profesor) {
  return [profesor.nombre, profesor.apellidos].filter(Boolean).join(" ");
}

// Devuelve copias de los grupos con profesores, profesores_ids y compartido. Se mantienen
// `profesor_id` (principal) y `profesor` (nombres unidos con " y "; si no hay ninguno, el valor previo).
export async function anotarProfesores(connection, grupos) {
  const lista = Array.isArray(grupos) ? grupos : [];
  const mapa = await profesoresDeGrupos(connection, lista.map((grupo) => grupo.id));
  return lista.map((grupo) => {
    const profesores = mapa.get(Number(grupo.id)) || [];
    return {
      ...grupo,
      profesor: profesores.length ? profesores.map(nombreCompleto).join(" y ") : grupo.profesor ?? null,
      profesores,
      profesores_ids: profesores.map((profesor) => profesor.id),
      compartido: profesores.length > 1,
    };
  });
}

// ¿Es `profesorId` uno de los profesores del grupo? `principalId` (grupos.profesor_id) evita la
// consulta cuando ya se conoce y coincide.
export async function esProfesorDelGrupo(connection, grupoId, profesorId, principalId = undefined) {
  if (!profesorId) return false;
  if (principalId !== undefined && principalId !== null && Number(principalId) === Number(profesorId)) return true;
  const tiene = await existeTablaGrupoProfesores(connection);
  if (!tiene) {
    if (principalId !== undefined) return false;
    const [rows] = await connection.query("SELECT id FROM grupos WHERE id = ? AND profesor_id = ? LIMIT 1", [grupoId, profesorId]);
    return rows.length > 0;
  }
  const condicion = condicionGruposDelProfesor(true, profesorId, "g");
  const [rows] = await connection.query(
    `SELECT g.id FROM grupos g WHERE g.id = ? AND ${condicion.sql} LIMIT 1`,
    [grupoId, ...condicion.params]
  );
  return rows.length > 0;
}

// Deja en `grupo_profesores` exactamente los profesores indicados (dentro de la transacción del
// llamador). Sin la tabla no hace nada y devuelve false.
export async function sincronizarProfesoresGrupo(connection, grupoId, profesoresIds) {
  if (!(await existeTablaGrupoProfesores(connection))) return false;
  const ids = [...new Set((profesoresIds || []).map(Number))];
  if (ids.length) {
    await connection.query(
      `DELETE FROM grupo_profesores WHERE grupo_id = ? AND profesor_id NOT IN (${ids.map(() => "?").join(", ")})`,
      [grupoId, ...ids]
    );
    for (const id of ids) {
      await connection.query("INSERT IGNORE INTO grupo_profesores (grupo_id, profesor_id) VALUES (?, ?)", [grupoId, id]);
    }
  } else {
    await connection.query("DELETE FROM grupo_profesores WHERE grupo_id = ?", [grupoId]);
  }
  return true;
}
