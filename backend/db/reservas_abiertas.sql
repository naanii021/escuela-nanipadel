-- Migracion segura para reservas completas y partidas abiertas.
-- Ejecuta primero los SHOW para comprobar si tu MySQL ya tiene alguna columna.

SHOW COLUMNS FROM reservas_pista;
SHOW COLUMNS FROM reservas_pista LIKE 'estado';

ALTER TABLE reservas_pista
  ADD COLUMN tipo_reserva ENUM('completa', 'abierta') NOT NULL DEFAULT 'completa' AFTER duracion_min,
  ADD COLUMN max_jugadores TINYINT UNSIGNED NOT NULL DEFAULT 4 AFTER tipo_reserva,
  ADD COLUMN nivel_min TINYINT UNSIGNED NULL AFTER max_jugadores,
  ADD COLUMN nivel_max TINYINT UNSIGNED NULL AFTER nivel_min;

-- Si estado es ENUM y no contiene estos valores, amplia el enum.
ALTER TABLE reservas_pista
  MODIFY COLUMN estado ENUM('abierta', 'confirmada', 'cancelada') NOT NULL DEFAULT 'confirmada';

CREATE TABLE IF NOT EXISTS reservas_pista_participantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT NOT NULL,
  usuario_id INT NULL,
  alumno_id INT NULL,
  estado ENUM('confirmado', 'cancelado') NOT NULL DEFAULT 'confirmado',
  es_creador TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_reserva_usuario (reserva_id, usuario_id),
  UNIQUE KEY uq_reserva_alumno (reserva_id, alumno_id),

  CONSTRAINT fk_participante_reserva
    FOREIGN KEY (reserva_id)
    REFERENCES reservas_pista(id)
    ON DELETE CASCADE
);

-- Ejecuta estos SHOW antes de crear indices si no sabes si existen ya.
SHOW INDEX FROM reservas_pista;

CREATE INDEX idx_reservas_pista_fecha
  ON reservas_pista (fecha, pista_id, hora_inicio);

CREATE INDEX idx_reservas_pista_tipo_estado
  ON reservas_pista (tipo_reserva, estado);

-- Nivel de juego para usuarios/alumnos. No ejecutes un ALTER si la columna ya existe.
SHOW COLUMNS FROM usuarios LIKE 'nivel_juego';
ALTER TABLE usuarios
  ADD COLUMN nivel_juego TINYINT UNSIGNED NULL;

SHOW COLUMNS FROM alumnos LIKE 'nivel_juego';
ALTER TABLE alumnos
  ADD COLUMN nivel_juego TINYINT UNSIGNED NULL;
