-- Bandeja de entrada de WhatsApp para administracion.
-- Ejecutar manualmente en MySQL cuando se quiera activar la bandeja.
-- No usar DROP, DELETE ni TRUNCATE.

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wa_id VARCHAR(40) NOT NULL,
  telefono VARCHAR(40) NOT NULL,
  nombre_contacto VARCHAR(180) NULL,
  estado ENUM('pendiente','abierta','atendida','cerrada') NOT NULL DEFAULT 'pendiente',
  ultimo_mensaje TEXT NULL,
  ultimo_mensaje_en DATETIME NULL,
  ultimo_mensaje_cliente_en DATETIME NULL,
  ventana_24h_hasta DATETIME NULL,
  atendido_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_whatsapp_conversations_wa_id (wa_id),
  KEY idx_whatsapp_conversations_estado (estado),
  KEY idx_whatsapp_conversations_ultimo (ultimo_mensaje_en),
  CONSTRAINT fk_whatsapp_conversations_atendido_por
    FOREIGN KEY (atendido_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  meta_message_id VARCHAR(120) NULL,
  direccion ENUM('inbound','outbound') NOT NULL,
  tipo ENUM('text','template','image','audio','document','unknown') NOT NULL DEFAULT 'text',
  contenido TEXT NULL,
  estado ENUM('recibido','enviado','entregado','leido','error') NOT NULL DEFAULT 'recibido',
  error_message TEXT NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_whatsapp_messages_conversation (conversation_id),
  KEY idx_whatsapp_messages_meta_message (meta_message_id),
  CONSTRAINT fk_whatsapp_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id)
    ON DELETE CASCADE
);
