-- Migracion segura para el perfil de usuario.
-- Ejecuta primero los SHOW COLUMNS para no duplicar columnas si ya existen.

SHOW COLUMNS FROM usuarios;

ALTER TABLE usuarios
  ADD COLUMN apellidos VARCHAR(160) NULL,
  ADD COLUMN foto_perfil_url VARCHAR(500) NULL,
  ADD COLUMN nivel_juego TINYINT UNSIGNED NULL,
  ADD COLUMN mano_dominante ENUM('derecha','izquierda') NULL,
  ADD COLUMN lado_preferido ENUM('drive','reves','ambos') NULL,
  ADD COLUMN ciudad VARCHAR(120) NULL,
  ADD COLUMN club_habitual VARCHAR(160) NULL,
  ADD COLUMN disponibilidad_general VARCHAR(160) NULL,
  ADD COLUMN preferencias_notificacion VARCHAR(160) NULL,
  ADD COLUMN buscar_partidas_abiertas TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN privacidad_perfil VARCHAR(160) NULL;

-- Campos profesionales para profesor/admin.
-- Si mas adelante prefieres una tabla perfiles_profesionales, estos mismos campos se pueden mover sin tocar la UI.
ALTER TABLE usuarios
  ADD COLUMN zona_trabajo VARCHAR(255) NULL,
  ADD COLUMN ciudad_base VARCHAR(120) NULL,
  ADD COLUMN pueblos_trabajo TEXT NULL,
  ADD COLUMN club_principal VARCHAR(160) NULL,
  ADD COLUMN otros_clubes TEXT NULL,
  ADD COLUMN tiene_club_propio TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN nombre_club_propio VARCHAR(160) NULL,
  ADD COLUMN especialidades TEXT NULL,
  ADD COLUMN anos_experiencia TINYINT UNSIGNED NULL,
  ADD COLUMN niveles_que_entrena VARCHAR(120) NULL,
  ADD COLUMN disponibilidad_laboral TEXT NULL,
  ADD COLUMN biografia_profesional TEXT NULL,
  ADD COLUMN instagram_profesional VARCHAR(160) NULL,
  ADD COLUMN telefono_profesional VARCHAR(30) NULL;
