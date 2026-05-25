-- Ejecutar manualmente en MySQL del miniPC antes de usar por completo las notificaciones nuevas.
-- No ejecutar desde el portátil ni desde el frontend.
-- Objetivo: hacer compatible una instalación antigua con el backend actual de notificaciones.

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER email_enabled,
  ADD COLUMN IF NOT EXISTS in_app_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER whatsapp_enabled,
  ADD COLUMN IF NOT EXISTS notify_reservas TINYINT(1) NOT NULL DEFAULT 1 AFTER in_app_enabled,
  ADD COLUMN IF NOT EXISTS notify_clases TINYINT(1) NOT NULL DEFAULT 1 AFTER notify_reservas,
  ADD COLUMN IF NOT EXISTS notify_club TINYINT(1) NOT NULL DEFAULT 1 AFTER notify_clases,
  ADD COLUMN IF NOT EXISTS notify_torneos TINYINT(1) NOT NULL DEFAULT 1 AFTER notify_club,
  ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(30) NULL AFTER notify_torneos;

UPDATE notification_preferences
SET usuario_id = COALESCE(usuario_id, user_id)
WHERE usuario_id IS NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(60) NULL AFTER mensaje,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT NULL AFTER referencia_tipo,
  ADD COLUMN IF NOT EXISTS read_at DATETIME NULL AFTER estado,
  ADD COLUMN IF NOT EXISTS sent_at DATETIME NULL AFTER read_at,
  ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NULL AFTER sent_at,
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(180) NULL AFTER error_message,
  ADD COLUMN IF NOT EXISTS payload JSON NULL AFTER provider_message_id,
  ADD COLUMN IF NOT EXISTS created_by_user_id INT NULL AFTER payload;
