// Respuestas de la BD simulada para las consultas de "varios profesores por grupo".
// Cada test añade al inicio de su `query`:  const gpRes = consultaGp(sql, params); if (gpRes) return gpRes;
//
// Estado configurable (se reinicia con resetGp()):
//   gp.tabla       ¿existe grupo_profesores?
//   gp.profesores  Map grupoId -> [{ id, nombre, apellidos }] (principal primero)
//   gp.miembros    Map grupoId -> Set de profesor_id presentes en grupo_profesores
//   gp.nombres     Map profesorId -> { nombre, apellidos }
//   gp.agregado    (sesionId) => [{ estado, total, en }] (resumen de asistencia_clase)
//   gp.consultas   SQL recibido, por si un test quiere inspeccionarlo
export const gp = {
  tabla: false,
  profesores: new Map(),
  miembros: new Map(),
  nombres: new Map(),
  agregado: () => [],
  consultas: [],
};

export function resetGp() {
  gp.tabla = false;
  gp.profesores = new Map();
  gp.miembros = new Map();
  gp.nombres = new Map();
  gp.agregado = () => [];
  gp.consultas = [];
}

export function consultaGp(sql, params = []) {
  if (sql === "SHOW TABLES LIKE 'grupo_profesores'") return [gp.tabla ? [{ Tables_in_db: "grupo_profesores" }] : []];
  if (sql.startsWith("SELECT g.id AS grupo_id, p.id, p.nombre, p.apellidos")) {
    gp.consultas.push({ sql, params });
    const filas = [];
    for (const id of params) for (const prof of gp.profesores.get(Number(id)) || []) filas.push({ grupo_id: Number(id), ...prof });
    return [filas];
  }
  if (sql.startsWith("SELECT g.id FROM grupos g WHERE g.id = ? AND")) {
    gp.consultas.push({ sql, params });
    return [gp.miembros.get(Number(params[0]))?.has(Number(params[1])) ? [{ id: Number(params[0]) }] : []];
  }
  if (sql.startsWith("SELECT nombre, apellidos FROM profesores WHERE id = ?")) {
    const id = Number(params[0]);
    return [[gp.nombres.get(id) || { nombre: `Profe${id}`, apellidos: "" }]];
  }
  if (sql.startsWith("SELECT estado, COUNT(*) AS total, MAX(updated_at) AS en FROM asistencia_clase")) {
    return [gp.agregado(Number(params[0]))];
  }
  return null;
}
