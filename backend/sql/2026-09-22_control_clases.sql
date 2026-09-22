-- Ejecutar una vez en la BD real antes de activar Control de clases.
-- sesiones_clase es la tabla oficial; este script no usa sesiones ni asistencias.
-- Si sesiones_clase ya existe, verificar con DESCRIBE que tiene las columnas indicadas.

CREATE TABLE IF NOT EXISTS sesiones_clase (
  id INT NOT NULL AUTO_INCREMENT,
  grupo_id INT NOT NULL,
  profesor_id INT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado VARCHAR(32) NOT NULL DEFAULT 'programada',
  observaciones TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_clase_grupo_fecha (grupo_id, fecha),
  KEY idx_sesiones_clase_profesor (profesor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asistencia_clase (
  id INT NOT NULL AUTO_INCREMENT,
  sesion_id BIGINT UNSIGNED NOT NULL,
  alumno_id BIGINT UNSIGNED NOT NULL,
  estado ENUM('presente', 'falta', 'justificada') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asistencia_clase_sesion_alumno (sesion_id, alumno_id),
  KEY idx_asistencia_clase_alumno (alumno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
