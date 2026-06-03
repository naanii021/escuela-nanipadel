-- Gestion avanzada de Americano/Judex.
-- Ejecutar manualmente en MySQL del miniPC cuando se quiera activar parejas e incidencias.
-- No se ejecuta automaticamente desde backend ni frontend.

CREATE TABLE IF NOT EXISTS americano_parejas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id INT UNSIGNED NOT NULL,
  jugador1_alumno_id INT NOT NULL,
  jugador2_alumno_id INT NULL,
  jugador1_nombre VARCHAR(180) NULL,
  jugador2_nombre VARCHAR(180) NULL,
  estado ENUM('activa','baja','reserva') NOT NULL DEFAULT 'activa',
  notas VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_parejas_americano (americano_id),
  KEY idx_americano_parejas_jugador1 (jugador1_alumno_id),
  KEY idx_americano_parejas_jugador2 (jugador2_alumno_id),
  CONSTRAINT fk_americano_parejas_americano
    FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_americano_parejas_jugador1
    FOREIGN KEY (jugador1_alumno_id) REFERENCES alumnos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_americano_parejas_jugador2
    FOREIGN KEY (jugador2_alumno_id) REFERENCES alumnos(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS americano_incidencias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id INT UNSIGNED NOT NULL,
  partido_id INT UNSIGNED NULL,
  pareja_id INT UNSIGNED NULL,
  tipo ENUM('horario','pista','lesion','ausencia','organizacion','otro') NOT NULL DEFAULT 'otro',
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  estado ENUM('abierta','resuelta') NOT NULL DEFAULT 'abierta',
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_incidencias_americano (americano_id),
  KEY idx_americano_incidencias_estado (estado),
  CONSTRAINT fk_americano_incidencias_americano
    FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_americano_incidencias_partido
    FOREIGN KEY (partido_id) REFERENCES americano_partidos(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_americano_incidencias_pareja
    FOREIGN KEY (pareja_id) REFERENCES americano_parejas(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_americano_incidencias_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
);
