-- Funcionalidad Americano / Judex para torneos rapidos.
-- Ejecutar en MySQL antes de usar el panel de gestion.

CREATE TABLE IF NOT EXISTS torneos_americanos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(180) NOT NULL,
  fecha DATE NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'Judex',
  pistas VARCHAR(160) NULL,
  duracion_min INT UNSIGNED NULL,
  observaciones TEXT NULL,
  estado ENUM('preparacion','en_curso','finalizado','cancelado') NOT NULL DEFAULT 'preparacion',
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americanos_fecha (fecha),
  KEY idx_americanos_estado (estado),
  CONSTRAINT fk_americanos_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS americano_participantes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id INT UNSIGNED NOT NULL,
  alumno_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_americano_alumno (americano_id, alumno_id),
  KEY idx_americano_participantes_alumno (alumno_id),
  CONSTRAINT fk_americano_participantes_americano
    FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_americano_participantes_alumno
    FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS americano_partidos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id INT UNSIGNED NOT NULL,
  ronda INT UNSIGNED NULL,
  orden INT UNSIGNED NULL,
  equipo_a_alumno_1_id INT NOT NULL,
  equipo_a_alumno_2_id INT NULL,
  equipo_b_alumno_1_id INT NOT NULL,
  equipo_b_alumno_2_id INT NULL,
  puntos_a INT NOT NULL DEFAULT 0,
  puntos_b INT NOT NULL DEFAULT 0,
  estado ENUM('pendiente','jugado') NOT NULL DEFAULT 'pendiente',
  notas VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_partidos_americano (americano_id, ronda, orden),
  CONSTRAINT fk_americano_partidos_americano
    FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_a1 FOREIGN KEY (equipo_a_alumno_1_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_a2 FOREIGN KEY (equipo_a_alumno_2_id) REFERENCES alumnos(id) ON DELETE SET NULL,
  CONSTRAINT fk_americano_partidos_b1 FOREIGN KEY (equipo_b_alumno_1_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_b2 FOREIGN KEY (equipo_b_alumno_2_id) REFERENCES alumnos(id) ON DELETE SET NULL
);
