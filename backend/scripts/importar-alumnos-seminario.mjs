import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dataPath = args.find((arg) => !arg.startsWith("--"));

if (!dataPath) {
  console.error("Uso: node importar_alumnos_seminario.mjs RUTA_JSON [--apply]");
  process.exit(2);
}

const payload = JSON.parse(await fs.readFile(path.resolve(dataPath), "utf8"));
const records = payload.records;

if (!Array.isArray(records) || records.length === 0) {
  throw new Error("El archivo no contiene registros para importar");
}

const normalizedKeys = new Set();
for (const record of records) {
  if (!record.source_id || !record.nombre || !record.apellidos) {
    throw new Error("Hay un registro sin identificador, nombre o apellidos");
  }
  if (record.sede !== "Seminario Diocesano" || record.curso !== "2026/27") {
    throw new Error("Hay un registro de otra sede o curso");
  }
  const key = `${record.nombre} ${record.apellidos}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
  if (normalizedKeys.has(key)) {
    throw new Error("El lote contiene nombres duplicados");
  }
  normalizedKeys.add(key);
}

const requiredEnv = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`Falta la variable ${name}`);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
});

let insertedStudents = 0;
let insertedEnrollments = 0;

try {
  await connection.beginTransaction();

  const [sites] = await connection.execute(
    "SELECT id FROM sedes WHERE nombre = ?",
    ["Seminario Diocesano"]
  );
  if (sites.length !== 1) throw new Error("No existe una única sede Seminario Diocesano");

  const [courses] = await connection.execute(
    "SELECT id FROM cursos_escolares WHERE nombre = ? AND activo = 1",
    ["2026/27"]
  );
  if (courses.length !== 1) throw new Error("No existe un único curso 2026/27 activo");

  const [[studentCount]] = await connection.query("SELECT COUNT(*) AS total FROM alumnos");
  if (Number(studentCount.total) !== 0) {
    throw new Error("La tabla alumnos ya contiene registros; se cancela para evitar duplicados");
  }

  for (const record of records) {
    const [student] = await connection.execute(
      `INSERT INTO alumnos
        (nombre, apellidos, nivel, nivel_juego, telefono, tutor_telefono, email, activo, observaciones, usuario_id)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?, NULL)`,
      [
        record.nombre,
        record.apellidos,
        record.nivel,
        record.telefono,
        record.tutor_telefono,
        record.email,
        record.observaciones,
      ]
    );
    insertedStudents += student.affectedRows;

    const [enrollment] = await connection.execute(
      `INSERT INTO alumno_curso
        (alumno_id, curso_id, sede_id, estado, fecha_baja)
       VALUES (?, ?, ?, 'pendiente_grupo', NULL)`,
      [student.insertId, courses[0].id, sites[0].id]
    );
    insertedEnrollments += enrollment.affectedRows;
  }

  if (insertedStudents !== records.length || insertedEnrollments !== records.length) {
    throw new Error("Los recuentos de inserción no coinciden con el lote");
  }

  if (apply) {
    await connection.commit();
  } else {
    await connection.rollback();
  }

  console.log(JSON.stringify({
    mode: apply ? "APLICADO" : "SIMULACION",
    records: records.length,
    students: insertedStudents,
    enrollments: insertedEnrollments,
  }));
} catch (error) {
  await connection.rollback();
  console.error(`IMPORTACION_CANCELADA: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
