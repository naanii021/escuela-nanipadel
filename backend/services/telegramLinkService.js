import crypto from "node:crypto";
import { db } from "../db/connection.js";

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

export async function createTelegramLinkCode(profesorId, executor = db.promise()) {
  const code = crypto.randomBytes(18).toString("base64url");
  await executor.query(
    "UPDATE telegram_profesor_codigos SET usado_en = NOW() WHERE profesor_id = ? AND usado_en IS NULL",
    [profesorId]
  );
  await executor.query(
    `INSERT INTO telegram_profesor_codigos (profesor_id, codigo_hash, expira_en)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [profesorId, hashCode(code)]
  );
  return code;
}

export async function consumeTelegramLinkCode({ code, chatId, username }, pool = db.promise()) {
  if (!code || !chatId) return null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT c.id AS codigo_id, p.id, p.usuario_id, p.nombre, p.apellidos
       FROM telegram_profesor_codigos c
       JOIN profesores p ON p.id = c.profesor_id AND p.activo = 1
       WHERE c.codigo_hash = ? AND c.usado_en IS NULL AND c.expira_en > NOW()
       LIMIT 1 FOR UPDATE`,
      [hashCode(code)]
    );
    const professor = rows[0];
    if (!professor) {
      await connection.rollback();
      return null;
    }
    const [linked] = await connection.query(
      "SELECT id FROM profesores WHERE telegram_chat_id = ? AND id <> ? LIMIT 1 FOR UPDATE",
      [String(chatId), professor.id]
    );
    if (linked.length) {
      await connection.rollback();
      return null;
    }
    await connection.query(
      "UPDATE profesores SET telegram_chat_id = ?, telegram_username = ? WHERE id = ?",
      [String(chatId), username || null, professor.id]
    );
    await connection.query("UPDATE telegram_profesor_codigos SET usado_en = NOW() WHERE id = ?", [professor.codigo_id]);
    await connection.commit();
    return professor;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getTelegramProfessor(chatId, executor = db.promise()) {
  const [rows] = await executor.query(
    `SELECT id, usuario_id, nombre, apellidos, telegram_chat_id, telegram_username
     FROM profesores
     WHERE telegram_chat_id = ? AND activo = 1
     LIMIT 1`,
    [String(chatId)]
  );
  return rows[0] || null;
}
