-- Revisar y ejecutar manualmente en la BD real antes de arrancar el bot.
-- No contiene el token de Telegram y la aplicación no la ejecuta automáticamente.

ALTER TABLE profesores
  ADD COLUMN telegram_chat_id BIGINT NULL,
  ADD COLUMN telegram_username VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_profesores_telegram_chat_id (telegram_chat_id);

CREATE TABLE telegram_profesor_codigos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profesor_id BIGINT UNSIGNED NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  expira_en DATETIME NOT NULL,
  usado_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_telegram_profesor_codigos_hash (codigo_hash),
  KEY idx_telegram_profesor_codigos_profesor (profesor_id),
  KEY idx_telegram_profesor_codigos_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Antes de ejecutar CREATE TABLE, ajustar profesor_id al tipo exacto de profesores.id.
-- Después de verificarlo, se puede añadir esta FK opcional:
-- ALTER TABLE telegram_profesor_codigos
--   ADD CONSTRAINT fk_telegram_codigos_profesor
--   FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE;
