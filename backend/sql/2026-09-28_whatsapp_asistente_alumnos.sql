-- PROPUESTA PARA REVISAR EN LA BD REAL. No se ejecuta desde la aplicación.
-- Asistente de WhatsApp para alumnos/familias: guarda qué alumno se está consultando
-- en cada conversación (un teléfono puede ser de varios hermanos).
-- Requiere antes 2026-06-03_whatsapp_inbox.sql. No usa DROP, DELETE ni TRUNCATE.

-- 1) Comprobaciones previas. Detenerse aquí y revisar los resultados.
SHOW CREATE TABLE alumnos;
SHOW CREATE TABLE whatsapp_conversations;
SHOW COLUMNS FROM alumnos LIKE 'telefono';
SHOW COLUMNS FROM alumnos LIKE 'tutor_telefono';

-- Teléfonos que el asistente no sabrá normalizar (varios números en un campo, fijos 8xx,
-- letras...). Esos alumnos no serán reconocidos hasta corregir el dato.
SELECT id, nombre, apellidos, telefono
FROM alumnos
WHERE activo = 1 AND telefono IS NOT NULL AND telefono <> ''
  AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '')
      NOT REGEXP '^((\\+|00)[0-9]{9,15}|[679][0-9]{8}|[0-9]{10,15})$';
-- Repetir la misma consulta cambiando telefono por tutor_telefono si esa columna ya existe.

-- Teléfonos compartidos entre alumnos activos (hermanos): el asistente pedirá elegir.
SELECT telefono, COUNT(*) AS alumnos, GROUP_CONCAT(CONCAT(nombre, ' ', apellidos) SEPARATOR ', ') AS nombres
FROM alumnos
WHERE activo = 1 AND telefono IS NOT NULL AND telefono <> ''
GROUP BY telefono
HAVING COUNT(*) > 1;

-- 2) Solo si SHOW COLUMNS no devolvió tutor_telefono. Si ya existe, NO ejecutar.
-- El código funciona sin esta columna (solo busca por alumnos.telefono).
ALTER TABLE alumnos
  ADD COLUMN tutor_telefono VARCHAR(30) NULL AFTER telefono;

-- 3) Tabla auxiliar. conversation_id debe tener el mismo tipo que whatsapp_conversations.id
-- (INT en la migración de la bandeja) y alumno_id el mismo tipo que alumnos.id.
CREATE TABLE IF NOT EXISTS whatsapp_conversacion_alumno (
  conversation_id INT NOT NULL,
  alumno_id INT NULL,
  intencion_pendiente VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  KEY idx_whatsapp_conversacion_alumno_alumno (alumno_id),
  CONSTRAINT fk_whatsapp_conversacion_alumno_conversation
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FK opcional hacia alumnos, tras confirmar que el tipo de alumno_id coincide con alumnos.id:
-- ALTER TABLE whatsapp_conversacion_alumno
--   ADD CONSTRAINT fk_whatsapp_conversacion_alumno_alumno
--   FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE SET NULL;

-- 4) Activar el asistente en backend/.env (desactivado por defecto):
-- WHATSAPP_ASSISTANT_ENABLED=true
