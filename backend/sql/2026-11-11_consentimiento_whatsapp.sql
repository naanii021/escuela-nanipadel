-- BORRADOR OPCIONAL PARA REVISAR. NO se ha ejecutado y la aplicación no lo ejecuta.
-- Consentimiento para recibir avisos de clase por WhatsApp (los alumnos son menores:
-- consiente el tutor o, si es mayor de edad, el propio alumno).
-- Ejecutar a mano solo cuando la escuela haya recogido los consentimientos.
-- No usa DROP, DELETE ni TRUNCATE.
--
-- Efecto en el código: backend/services/avisoCancelacionService.js detecta la columna
-- `alumnos.acepta_whatsapp`. Si existe, SOLO avisa a los alumnos con valor 1; con NULL (sin
-- respuesta) o 0 (no quiere) no envía. Sin la columna, el aviso depende solo de la casilla
-- explícita del profe en cada cancelación.

-- 1) Comprobación previa: tiene que devolver 0 filas (la columna aún no existe).
SHOW COLUMNS FROM alumnos LIKE 'acepta_whatsapp';

-- 2) Columna. NULL = sin respuesta, 1 = acepta, 0 = no acepta.
ALTER TABLE alumnos
  ADD COLUMN acepta_whatsapp TINYINT(1) NULL DEFAULT NULL AFTER tutor_telefono,
  ADD COLUMN acepta_whatsapp_fecha DATE NULL DEFAULT NULL AFTER acepta_whatsapp;

-- 3) Cuando se recoja un consentimiento (ejemplo para un alumno concreto):
-- UPDATE alumnos SET acepta_whatsapp = 1, acepta_whatsapp_fecha = CURDATE() WHERE id = ?;
