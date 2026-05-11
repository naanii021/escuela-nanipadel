-- Sistema centralizado de notificaciones NaniPadel.
-- Ejecuta este archivo antes de activar las rutas nuevas en produccion.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 0,
  notify_reservas TINYINT(1) NOT NULL DEFAULT 1,
  notify_clases TINYINT(1) NOT NULL DEFAULT 1,
  notify_club TINYINT(1) NOT NULL DEFAULT 1,
  notify_torneos TINYINT(1) NOT NULL DEFAULT 1,
  whatsapp_phone VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_preferences_user (user_id),
  CONSTRAINT fk_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  category ENUM('reservas','clases','club','torneos') NOT NULL,
  channel ENUM('email','whatsapp','in_app') NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('pending','sent','delivered','failed','skipped') NOT NULL DEFAULT 'pending',
  read_at DATETIME NULL,
  sent_at DATETIME NULL,
  error_message VARCHAR(500) NULL,
  provider_message_id VARCHAR(180) NULL,
  payload JSON NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_channel_read (user_id, channel, read_at),
  KEY idx_notifications_status_channel (status, channel),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(60) NOT NULL,
  channel ENUM('email','whatsapp','in_app') NOT NULL,
  title_template VARCHAR(180) NOT NULL,
  body_template TEXT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_templates_event_channel (event_type, channel)
);
