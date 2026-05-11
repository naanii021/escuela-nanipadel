CREATE TABLE IF NOT EXISTS galeria_fotos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'Otros',
  archivo_url VARCHAR(500) NOT NULL,
  archivo_nombre VARCHAR(255) NULL,
  estado ENUM('pendiente', 'aprobada', 'rechazada', 'eliminada') NOT NULL DEFAULT 'pendiente',
  motivo_rechazo TEXT NULL,
  aprobado_por INT NULL,
  fecha_aprobacion DATETIME NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_galeria_estado ON galeria_fotos (estado);
CREATE INDEX idx_galeria_categoria ON galeria_fotos (categoria);
CREATE INDEX idx_galeria_usuario ON galeria_fotos (usuario_id);
