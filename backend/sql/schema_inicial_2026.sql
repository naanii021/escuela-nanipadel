-- =====================================================================
-- schema_inicial_2026.sql
-- PROPUESTA de esquema inicial para escuela_nani_padel_v2 (MySQL 8.4 LTS)
-- Rama: curso-2026-27-resumen
--
-- NO SE HA EJECUTADO. Es una propuesta para revisar antes de aplicar en
-- Docker. No crea la base de datos (CREATE DATABASE/USE) a propósito:
-- decide tú el nombre final, el usuario y el charset del servidor.
--
-- ORIGEN DE LOS DATOS
-- -------------------
-- Ninguna tabla base (usuarios, alumnos, profesores, grupos, pistas,
-- reservas_pista, torneos, recuperaciones_clase, avisos_clase,
-- torneo_inscripciones) tenía un CREATE TABLE en el repo: solo existían
-- ALTER TABLE sueltos sobre una base que ya no tenemos. Esta propuesta se
-- ha reconstruido leyendo entero cada fichero de backend/routes y
-- backend/services (SHOW COLUMNS dinámicos, INSERT/UPDATE, JOIN, filtros
-- WHERE, validaciones de rango) más los ficheros SQL existentes en
-- backend/db/ y backend/sql/.
--
-- CÓMO LEER LOS COMENTARIOS DE CADA BLOQUE
-- -----------------------------------------
--   [CONFIRMADO]      La columna, tipo o restricción se deduce de forma
--                      directa e inequívoca del código o de un SQL existente.
--   [DECISIÓN]         El código no fija el tipo exacto (longitud, NULL/NOT
--                      NULL, nombre de columna de timestamps, etc.). Se
--                      propone un valor razonable; revísalo.
--   [INCOMPATIBILIDAD] Se ha detectado una contradicción real entre
--                      migraciones existentes, o entre una migración y el
--                      código actual. Se explica y se indica cómo se ha
--                      resuelto aquí.
--
-- RESUMEN DE INCOMPATIBILIDADES DETECTADAS (detalle en cada tabla)
-- ------------------------------------------------------------------
-- 1) sesiones_clase.id es INT (con signo) en 2026-09-22_control_clases.sql,
--    pero asistencia_clase.sesion_id se declaró BIGINT UNSIGNED en el mismo
--    fichero. MySQL 8.4 no permite crear una FK entre tipos distintos.
--    Resuelto: ambas columnas pasan a INT UNSIGNED.
-- 2) torneos_americanos.id es INT UNSIGNED (americanos_judex.sql) pero
--    americano_parejas.id y americano_incidencias.id son INT con signo
--    (2026-06-03_americano_gestion.sql), y americano_parejas.americano_id
--    también es INT con signo referenciando esa PK UNSIGNED. MySQL exige
--    mismo tipo y mismo signo para la FK. Resuelto: todo el bloque
--    Americano pasa a INT UNSIGNED de forma consistente.
-- 3) reservas_pista_participantes, tal como se definió en
--    backend/db/reservas_abiertas.sql, NO tiene las columnas
--    tipo_participante, nombre_invitado ni invitado_de_usuario_id, pero
--    backend/routes/reservas.js las usa en cada INSERT/UPDATE de partidas
--    abiertas con invitados. Son columnas reales que existían en la base
--    perdida pero nunca se documentaron en una migración. Añadidas aquí.
-- 4) torneos.imagen_url se usa en backend/routes/torneos.js (POST /,
--    alias intercambiable con cartel_url) pero ninguna migración la crea.
--    Añadida aquí junto a cartel_url.
-- 5) notification_preferences.in_app_enabled: el CREATE TABLE original
--    (backend/db/notificaciones.sql) pone DEFAULT 0, pero la migración de
--    compatibilidad (2026-05-24) y el propio código
--    (notificationService.js) siempre insertan 1. Resuelto con DEFAULT 1.
-- 6) telegram_profesor_codigos.profesor_id se dejó sin FK y con un
--    comentario "ajustar al tipo exacto de profesores.id" porque no se
--    sabía ese tipo. Con profesores.id fijado aquí en INT UNSIGNED, se
--    añade la FK que el fichero original dejaba pendiente.
-- 7) whatsapp_conversacion_alumno.alumno_id se dejó sin FK por la misma
--    razón (tipo de alumnos.id no confirmado en ese momento). Añadida aquí.
--
-- TABLAS NO REFERENCIADAS POR EL BACKEND ACTUAL
-- ------------------------------------------------
-- - notification_templates: existe en backend/db/notificaciones.sql pero
--   ningún route/service la usa hoy (notifyEvent no la consulta). Se
--   incluye igual porque formaba parte del diseño original; si no la vas
--   a usar, puedes omitirla sin romper nada.
-- - meteo_xiao: solo aparece en backend/routes/asistente.js con un SELECT
--   de solo lectura. Es una tabla alimentada por hardware externo (sensor
--   del miniPC/microcontrolador), no por este backend. Sus tipos son una
--   estimación razonable, no una confirmación de código.
-- =====================================================================

SET NAMES utf8mb4;

-- =====================================================================
-- BLOQUE 1: NÚCLEO (sedes, curso escolar, identidad)
-- =====================================================================

-- [DECISIÓN] nombre UNIQUE: se busca siempre por coincidencia exacta de
-- nombre ("Seminario Diocesano"), nunca por id en el código de arranque.
CREATE TABLE sedes (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sedes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] activo: gestion.js y gestionControl.js filtran siempre
-- "WHERE c.activo = 1" y toman el curso activo más reciente por sede.
CREATE TABLE cursos_escolares (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(80)  NOT NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] email UNIQUE (routes/auth.js y perfil.js comprueban
-- duplicados antes de insertar/actualizar). rol y activo confirmados por
-- uso directo ("WHERE activo = 1", "rol IN (...)").
-- [DECISIÓN] rol es VARCHAR y no ENUM: el código trata 'profesor' y
-- 'profe' como sinónimos de staff (STAFF_ROLES = ["admin","profesor","profe"]),
-- lo que sugiere datos heredados inconsistentes. Para v2 se recomienda
-- normalizar a 'profesor' y retirar 'profe', pero se deja como VARCHAR +
-- CHECK para no romper el código existente si todavía escribe 'profe'.
-- [CONFIRMADO] Todos los campos de perfil personal/profesional y sus
-- longitudes exactas vienen de backend/db/perfil_usuario.sql (es la única
-- migración de este fichero que SÍ tenía CREATE/ALTER con tipos reales).
CREATE TABLE usuarios (
  id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre                      VARCHAR(160) NOT NULL,                         -- [DECISIÓN] longitud
  apellidos                   VARCHAR(160) NULL,                             -- [CONFIRMADO]
  email                       VARCHAR(190) NOT NULL,                        -- [DECISIÓN] longitud
  telefono                    VARCHAR(30)  NULL,                             -- [DECISIÓN] longitud
  password_hash               VARCHAR(255) NOT NULL,                         -- [DECISIÓN] longitud (bcrypt usa ~60)
  rol                         VARCHAR(20)  NOT NULL DEFAULT 'usuario',       -- [DECISIÓN] ver nota arriba
  activo                      TINYINT(1)   NOT NULL DEFAULT 1,               -- [CONFIRMADO]
  nivel_juego                 TINYINT UNSIGNED NULL,                         -- [CONFIRMADO] 0-6, ver CHECK
  foto_perfil_url             VARCHAR(500) NULL,                             -- [CONFIRMADO]
  mano_dominante              ENUM('derecha','izquierda') NULL,              -- [CONFIRMADO]
  lado_preferido              ENUM('drive','reves','ambos') NULL,            -- [CONFIRMADO]
  ciudad                      VARCHAR(120) NULL,                             -- [CONFIRMADO]
  club_habitual               VARCHAR(160) NULL,                             -- [CONFIRMADO]
  disponibilidad_general      VARCHAR(160) NULL,                             -- [CONFIRMADO]
  preferencias_notificacion   VARCHAR(160) NULL,                             -- [CONFIRMADO]
  buscar_partidas_abiertas    TINYINT(1)   NOT NULL DEFAULT 1,               -- [CONFIRMADO]
  privacidad_perfil           VARCHAR(160) NULL,                             -- [CONFIRMADO]
  zona_trabajo                VARCHAR(255) NULL,                             -- [CONFIRMADO]
  ciudad_base                 VARCHAR(120) NULL,                             -- [CONFIRMADO]
  pueblos_trabajo              TEXT NULL,                                    -- [CONFIRMADO]
  club_principal               VARCHAR(160) NULL,                            -- [CONFIRMADO]
  otros_clubes                 TEXT NULL,                                    -- [CONFIRMADO]
  tiene_club_propio            TINYINT(1) NOT NULL DEFAULT 0,                -- [CONFIRMADO]
  nombre_club_propio           VARCHAR(160) NULL,                            -- [CONFIRMADO]
  especialidades                TEXT NULL,                                   -- [CONFIRMADO]
  anos_experiencia              TINYINT UNSIGNED NULL,                       -- [CONFIRMADO] 0-80, ver CHECK
  niveles_que_entrena            VARCHAR(120) NULL,                          -- [CONFIRMADO]
  disponibilidad_laboral          TEXT NULL,                                 -- [CONFIRMADO]
  biografia_profesional            TEXT NULL,                                -- [CONFIRMADO]
  instagram_profesional             VARCHAR(160) NULL,                       -- [CONFIRMADO]
  telefono_profesional               VARCHAR(30) NULL,                       -- [CONFIRMADO]
  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- [DECISIÓN]
  updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- [DECISIÓN]
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  CONSTRAINT chk_usuarios_rol CHECK (rol IN ('admin','profesor','profe','alumno','usuario')),
  CONSTRAINT chk_usuarios_nivel_juego CHECK (nivel_juego IS NULL OR nivel_juego BETWEEN 0 AND 6),
  CONSTRAINT chk_usuarios_anos_experiencia CHECK (anos_experiencia IS NULL OR anos_experiencia BETWEEN 0 AND 80)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] nombre obligatorio, nivel_juego 0-6 (reservas.js
-- normalizeLevel), usuario_id opcional y consultado con "LIMIT 1" (se
-- asume 1:1 con usuarios -> UNIQUE). tutor_telefono AFTER telefono viene
-- literal de 2026-09-28_whatsapp_asistente_alumnos.sql.
CREATE TABLE alumnos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(160) NOT NULL,                     -- [CONFIRMADO]
  apellidos     VARCHAR(160) NULL,                         -- [CONFIRMADO]
  nivel         VARCHAR(40)  NULL,                         -- [DECISIÓN] etiqueta libre, distinta de nivel_juego
  nivel_juego   TINYINT UNSIGNED NULL,                     -- [CONFIRMADO] 0-6
  telefono      VARCHAR(30)  NULL,                          -- [CONFIRMADO]
  tutor_telefono VARCHAR(30) NULL,                          -- [CONFIRMADO] exacto de la migración
  email         VARCHAR(190) NULL,                          -- [CONFIRMADO]
  activo        TINYINT(1)   NOT NULL DEFAULT 1,            -- [CONFIRMADO]
  observaciones TEXT NULL,                                  -- [CONFIRMADO]
  usuario_id    INT UNSIGNED NULL,                          -- [CONFIRMADO]
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alumnos_usuario (usuario_id),               -- [DECISIÓN] 1 alumno <-> 1 usuario
  CONSTRAINT chk_alumnos_nivel_juego CHECK (nivel_juego IS NULL OR nivel_juego BETWEEN 0 AND 6),
  CONSTRAINT fk_alumnos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] activo=1 es condición dura en telegramLinkService.js
-- ("JOIN profesores p ON ... AND p.activo = 1"), no solo opcional.
-- telegram_chat_id/telegram_username exactos de 2026-09-23_telegram_profesores.sql.
CREATE TABLE profesores (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre             VARCHAR(160) NOT NULL,                 -- [CONFIRMADO]
  apellidos          VARCHAR(160) NULL,                     -- [CONFIRMADO]
  email              VARCHAR(190) NULL,                     -- [CONFIRMADO]
  usuario_id         INT UNSIGNED NULL,                     -- [CONFIRMADO]
  activo             TINYINT(1)   NOT NULL DEFAULT 1,        -- [CONFIRMADO]
  telegram_chat_id   BIGINT NULL,                            -- [CONFIRMADO]
  telegram_username  VARCHAR(255) NULL,                      -- [CONFIRMADO]
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profesores_telegram_chat_id (telegram_chat_id),  -- [CONFIRMADO]
  UNIQUE KEY uq_profesores_usuario (usuario_id),                 -- [DECISIÓN] 1 profesor <-> 1 usuario
  CONSTRAINT fk_profesores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] activa=1 usado directamente sin comprobación opcional
-- ("WHERE activa = 1" en reservas.js y gestion.js).
CREATE TABLE pistas (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,          -- [DECISIÓN] longitud
  activa      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 2: GRUPOS, MATRÍCULAS Y CONTROL DE CLASES
-- =====================================================================

-- [CONFIRMADO] dia1/dia2 son un único carácter (D/L/M/X/J/V/S, ver
-- gestionControl.js DAYS). hora_inicio y duracion_min obligatorios para
-- calcular hora_fin de las sesiones. pista_habitual es texto libre
-- denormalizado (no FK a pistas: se lista aparte en el catálogo).
CREATE TABLE grupos (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(40)  NULL,                      -- [DECISIÓN]
  nombre          VARCHAR(160) NOT NULL,                  -- [CONFIRMADO]
  nivel           VARCHAR(40)  NULL,                       -- [DECISIÓN]
  profesor_id     INT UNSIGNED NULL,                       -- [CONFIRMADO]
  dia1            CHAR(1)      NULL,                       -- [CONFIRMADO]
  dia2            CHAR(1)      NULL,                       -- [CONFIRMADO]
  hora_inicio     TIME         NOT NULL,                   -- [CONFIRMADO]
  duracion_min    SMALLINT UNSIGNED NOT NULL DEFAULT 60,   -- [CONFIRMADO]
  pista_habitual  VARCHAR(120) NULL,                       -- [CONFIRMADO] texto libre, no FK
  cupo            SMALLINT UNSIGNED NULL,                  -- [DECISIÓN]
  activo          TINYINT(1)   NOT NULL DEFAULT 1,         -- [CONFIRMADO]
  curso_id        INT UNSIGNED NOT NULL,                   -- [CONFIRMADO]
  sede_id         INT UNSIGNED NOT NULL,                   -- [CONFIRMADO]
  deporte         VARCHAR(40)  NULL DEFAULT 'Pádel',        -- [DECISIÓN]
  categoria       VARCHAR(60)  NULL,                        -- [DECISIÓN]
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_grupos_curso_sede (curso_id, sede_id, activo),
  KEY idx_grupos_profesor (profesor_id),
  CONSTRAINT fk_grupos_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE SET NULL,
  CONSTRAINT fk_grupos_curso FOREIGN KEY (curso_id) REFERENCES cursos_escolares(id) ON DELETE RESTRICT,
  CONSTRAINT fk_grupos_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Clave compuesta (alumno_id, curso_id, sede_id): el código
-- siempre consulta/actualiza por esa terna, nunca por un id propio.
-- estado confirmado por tests/gestion-matricula.test.js (usa estado, no
-- activo) con los 3 valores reales que aparecen en gestion.js.
-- [DECISIÓN] No se incluye una columna "activo" paralela: el código la
-- soporta solo como alternativa de compatibilidad con bases antiguas; en
-- un esquema nuevo "estado" es suficiente y es el camino que cubren los
-- tests actuales.
CREATE TABLE alumno_curso (
  alumno_id     INT UNSIGNED NOT NULL,
  curso_id      INT UNSIGNED NOT NULL,
  sede_id       INT UNSIGNED NOT NULL,
  estado        ENUM('pendiente_grupo','grupo_asignado','baja') NOT NULL DEFAULT 'pendiente_grupo',
  fecha_baja    DATE NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (alumno_id, curso_id, sede_id),
  KEY idx_alumno_curso_curso_sede (curso_id, sede_id, estado),
  CONSTRAINT fk_alumno_curso_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_alumno_curso_curso FOREIGN KEY (curso_id) REFERENCES cursos_escolares(id) ON DELETE RESTRICT,
  CONSTRAINT fk_alumno_curso_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Clave compuesta (grupo_id, alumno_id): igual que arriba,
-- el código siempre consulta/actualiza por esa pareja. asiste_dia1/2
-- confirmados con DEFAULT 1 (patrón COALESCE(ga.asiste_dia1, 1) repetido
-- en clases.js, gestionControl.js y gestion.js).
CREATE TABLE grupo_alumnos (
  grupo_id      INT UNSIGNED NOT NULL,
  alumno_id     INT UNSIGNED NOT NULL,
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  asiste_dia1   TINYINT(1) NOT NULL DEFAULT 1,
  asiste_dia2   TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grupo_id, alumno_id),
  KEY idx_grupo_alumnos_alumno (alumno_id),
  CONSTRAINT fk_grupo_alumnos_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_grupo_alumnos_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Estructura y UNIQUE KEY exactos de
-- backend/sql/2026-09-22_control_clases.sql.
-- [INCOMPATIBILIDAD] id pasa de INT (con signo) a INT UNSIGNED para poder
-- ser referenciado desde asistencia_clase.sesion_id y
-- recuperaciones_clase.sesion_origen_id/sesion_recuperacion_id sin chocar
-- de tipos (ver cabecera del fichero, punto 1).
CREATE TABLE sesiones_clase (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id      INT UNSIGNED NOT NULL,
  profesor_id   INT UNSIGNED NULL,
  fecha         DATE NOT NULL,
  hora_inicio   TIME NOT NULL,
  hora_fin      TIME NOT NULL,
  estado        VARCHAR(32) NOT NULL DEFAULT 'programada',   -- valores reales: programada, dada
  observaciones TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_clase_grupo_fecha (grupo_id, fecha),
  KEY idx_sesiones_clase_profesor (profesor_id),
  CONSTRAINT fk_sesiones_clase_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_sesiones_clase_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [INCOMPATIBILIDAD] sesion_id y alumno_id pasan de BIGINT UNSIGNED a
-- INT UNSIGNED para coincidir con sesiones_clase.id y alumnos.id (ver
-- cabecera, punto 1). El resto es exacto de la migración original.
CREATE TABLE asistencia_clase (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sesion_id     INT UNSIGNED NOT NULL,
  alumno_id     INT UNSIGNED NOT NULL,
  estado        ENUM('presente','falta','justificada') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asistencia_clase_sesion_alumno (sesion_id, alumno_id),
  KEY idx_asistencia_clase_alumno (alumno_id),
  CONSTRAINT fk_asistencia_clase_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_clase(id) ON DELETE CASCADE,
  CONSTRAINT fk_asistencia_clase_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Esta tabla NUNCA tuvo un CREATE TABLE propio en el repo:
-- solo existía backend/sql/2026-09-22_recuperaciones_clase.sql, que son
-- ALTER sobre una tabla ya existente y perdida. Se reconstruye entera a
-- partir de: los ALTER de esa migración (sesion_origen_id,
-- sesion_recuperacion_id, el ENUM de estado, motivo VARCHAR(255), el
-- UNIQUE (alumno_id, sesion_origen_id) y el KEY de sesion_recuperacion_id)
-- + las columnas base que gestionControl.js inserta/lee directamente
-- (alumno_id, grupo_id, fecha_original, fecha_recuperacion, observaciones).
CREATE TABLE recuperaciones_clase (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id               INT UNSIGNED NOT NULL,
  grupo_id                INT UNSIGNED NOT NULL,
  fecha_original          DATE NOT NULL,
  motivo                  VARCHAR(255) NULL,
  estado                  ENUM('pendiente','asignada','recuperada','cancelada') NOT NULL DEFAULT 'pendiente',
  sesion_origen_id        INT UNSIGNED NULL,
  sesion_recuperacion_id  INT UNSIGNED NULL,
  fecha_recuperacion      DATE NULL,
  observaciones           TEXT NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recuperacion_alumno_origen (alumno_id, sesion_origen_id),
  KEY idx_recuperacion_sesion_destino (sesion_recuperacion_id),
  KEY idx_recuperaciones_grupo (grupo_id),
  CONSTRAINT fk_recuperaciones_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_recuperaciones_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_recuperaciones_sesion_origen FOREIGN KEY (sesion_origen_id) REFERENCES sesiones_clase(id) ON DELETE SET NULL,
  CONSTRAINT fk_recuperaciones_sesion_destino FOREIGN KEY (sesion_recuperacion_id) REFERENCES sesiones_clase(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Tampoco tenía CREATE TABLE. Reconstruida de
-- backend/routes/clases.js: pickRefColumn prefiere "grupo_id", tipo
-- default 'info', visible_desde/visible_hasta comparados con NOW(),
-- activo con DEFAULT 1, creado_en referenciado directamente en el ORDER BY.
CREATE TABLE avisos_clase (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id        INT UNSIGNED NOT NULL,
  profesor_id     INT UNSIGNED NULL,
  titulo          VARCHAR(180) NOT NULL,
  mensaje         TEXT NOT NULL,
  tipo            VARCHAR(30) NOT NULL DEFAULT 'info',
  visible_desde   DATETIME NULL,
  visible_hasta   DATETIME NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_avisos_clase_grupo (grupo_id),
  KEY idx_avisos_clase_profesor (profesor_id),
  CONSTRAINT fk_avisos_clase_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_avisos_clase_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/sql/2026-09-23_telegram_profesores.sql.
-- [INCOMPATIBILIDAD] profesor_id pasa de BIGINT UNSIGNED (placeholder: el
-- fichero original decía literalmente "ajustar al tipo exacto de
-- profesores.id" y dejaba la FK comentada) a INT UNSIGNED, para that
-- coincidir con profesores.id tal como se fija en este esquema. Se añade
-- la FK que el fichero original dejaba pendiente.
CREATE TABLE telegram_profesor_codigos (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profesor_id   INT UNSIGNED NOT NULL,
  codigo_hash   CHAR(64) NOT NULL,
  expira_en     DATETIME NOT NULL,
  usado_en      DATETIME NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_telegram_profesor_codigos_hash (codigo_hash),
  KEY idx_telegram_profesor_codigos_profesor (profesor_id),
  KEY idx_telegram_profesor_codigos_expira (expira_en),
  CONSTRAINT fk_telegram_codigos_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 3: RESERVAS DE PISTA Y PARTIDAS ABIERTAS
-- =====================================================================

-- [CONFIRMADO] Tampoco tenía CREATE TABLE propio (reservas_abiertas.sql
-- solo tiene ALTER). Reconstruida de backend/routes/reservas.js: usuario_id
-- siempre presente (creador), alumno_id opcional, estado/tipo_reserva/
-- max_jugadores/nivel_min/nivel_max exactos de la migración de partidas
-- abiertas, duracion_min DEFAULT 90 confirmado en el payload de creación.
CREATE TABLE reservas_pista (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id      INT UNSIGNED NULL,
  usuario_id     INT UNSIGNED NOT NULL,
  nombre_cliente VARCHAR(160) NULL,
  telefono_cliente VARCHAR(30) NULL,
  pista_id       INT UNSIGNED NOT NULL,
  fecha          DATE NOT NULL,
  hora_inicio    TIME NOT NULL,
  duracion_min   SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  estado         ENUM('abierta','confirmada','cancelada') NOT NULL DEFAULT 'confirmada',
  tipo_reserva   ENUM('completa','abierta') NOT NULL DEFAULT 'completa',
  max_jugadores  TINYINT UNSIGNED NOT NULL DEFAULT 4,
  nivel_min      TINYINT UNSIGNED NULL,
  nivel_max      TINYINT UNSIGNED NULL,
  notas          TEXT NULL,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_pista_fecha (fecha, pista_id, hora_inicio),
  KEY idx_reservas_pista_tipo_estado (tipo_reserva, estado),
  KEY idx_reservas_pista_usuario (usuario_id, fecha),
  CONSTRAINT fk_reservas_pista_pista FOREIGN KEY (pista_id) REFERENCES pistas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservas_pista_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_reservas_pista_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE SET NULL,
  CONSTRAINT chk_reservas_pista_nivel CHECK (
    (nivel_min IS NULL OR nivel_min BETWEEN 0 AND 6) AND
    (nivel_max IS NULL OR nivel_max BETWEEN 0 AND 6)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [INCOMPATIBILIDAD] backend/db/reservas_abiertas.sql solo define id,
-- reserva_id, usuario_id, alumno_id, estado, es_creador, creado_en — pero
-- backend/routes/reservas.js inserta y actualiza también
-- tipo_participante, nombre_invitado e invitado_de_usuario_id en CADA
-- alta de partida abierta con invitados (ver insertarInvitadosPartida y
-- el INSERT ... ON DUPLICATE KEY UPDATE de "unirse"). Son columnas reales
-- de la base perdida que nunca llegaron a una migración: añadidas aquí.
-- Los dos UNIQUE KEY son exactos del fichero original.
CREATE TABLE reservas_pista_participantes (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reserva_id              INT UNSIGNED NOT NULL,
  usuario_id              INT UNSIGNED NULL,
  alumno_id               INT UNSIGNED NULL,
  tipo_participante       ENUM('usuario','invitado') NOT NULL DEFAULT 'usuario',
  nombre_invitado         VARCHAR(120) NULL,
  invitado_de_usuario_id  INT UNSIGNED NULL,
  estado                  ENUM('confirmado','cancelado') NOT NULL DEFAULT 'confirmado',
  es_creador              TINYINT(1) NOT NULL DEFAULT 0,
  creado_en               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reserva_usuario (reserva_id, usuario_id),
  UNIQUE KEY uq_reserva_alumno (reserva_id, alumno_id),
  KEY idx_participantes_invitado_de (invitado_de_usuario_id),
  CONSTRAINT fk_participante_reserva FOREIGN KEY (reserva_id) REFERENCES reservas_pista(id) ON DELETE CASCADE,
  CONSTRAINT fk_participante_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_participante_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE SET NULL,
  CONSTRAINT fk_participante_invitado_de FOREIGN KEY (invitado_de_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 4: TORNEOS (clásicos con inscripción + Americano/Judex)
-- =====================================================================

-- [CONFIRMADO] Combina la tabla base (sin CREATE TABLE propio,
-- reconstruida de routes/torneos.js) + backend/sql/2026-06-01_torneos_formatos.sql
-- (tipo_torneo, configuracion_formato, plazas_maximas, pistas_necesarias,
-- cartel_url, con sus "AFTER" originales).
-- [INCOMPATIBILIDAD] imagen_url se usa en el código (alias intercambiable
-- con cartel_url al crear un torneo) pero ninguna migración la crea:
-- añadida aquí junto a cartel_url.
CREATE TABLE torneos (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre                  VARCHAR(180) NOT NULL,
  descripcion             TEXT NULL,
  categoria               VARCHAR(80) NOT NULL,
  modalidad               VARCHAR(60) NULL,
  fecha_inicio            DATE NOT NULL,
  fecha_fin               DATE NULL,
  hora_inicio             TIME NULL,
  nivel                   VARCHAR(40) NULL,
  edad_min                TINYINT UNSIGNED NULL,
  edad_max                TINYINT UNSIGNED NULL,
  max_parejas             SMALLINT UNSIGNED NOT NULL DEFAULT 16,
  precio                  DECIMAL(8,2) NOT NULL DEFAULT 0,
  estado                  VARCHAR(20) NOT NULL DEFAULT 'proximo',   -- valores vistos: proximo, abierto (+ cancelaciones a nivel de inscripción)
  creado_por              INT UNSIGNED NULL,
  tipo_torneo             VARCHAR(50) NOT NULL DEFAULT 'americano',
  configuracion_formato   JSON NULL,
  plazas_maximas          INT UNSIGNED NULL,
  pistas_necesarias       TINYINT UNSIGNED NULL,
  cartel_url              VARCHAR(500) NULL,
  imagen_url              VARCHAR(500) NULL,                        -- [INCOMPATIBILIDAD] ver cabecera, punto 4
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_torneos_categoria_estado (categoria, estado),
  KEY idx_torneos_fecha_inicio (fecha_inicio),
  CONSTRAINT fk_torneos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Reconstruida de routes/torneos.js. estado DEFAULT se deja
-- como DECISIÓN ('inscrita'): el INSERT del código no fija valor, confía
-- en el DEFAULT de la tabla; el único valor explícito que el código
-- escribe es 'cancelada' al darse de baja.
-- [DECISIÓN] No se añade UNIQUE (torneo_id, usuario_id): el código
-- permite volver a inscribirse tras cancelar insertando una fila nueva
-- (hace SELECT ... WHERE estado != 'cancelada' antes de insertar, no usa
-- ON DUPLICATE KEY), así que una unicidad estricta rompería ese flujo.
CREATE TABLE torneo_inscripciones (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  torneo_id           INT UNSIGNED NOT NULL,
  usuario_id          INT UNSIGNED NOT NULL,
  nombre_pareja       VARCHAR(160) NULL,
  telefono_contacto   VARCHAR(30) NULL,
  estado              VARCHAR(20) NOT NULL DEFAULT 'inscrita',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_torneo_inscripciones_torneo (torneo_id, estado),
  KEY idx_torneo_inscripciones_usuario (usuario_id, estado),
  CONSTRAINT fk_torneo_inscripciones_torneo FOREIGN KEY (torneo_id) REFERENCES torneos(id) ON DELETE CASCADE,
  CONSTRAINT fk_torneo_inscripciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/db/americanos_judex.sql.
CREATE TABLE torneos_americanos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(180) NOT NULL,
  fecha          DATE NOT NULL,
  categoria      VARCHAR(80) NOT NULL DEFAULT 'Judex',
  pistas         VARCHAR(160) NULL,
  duracion_min   INT UNSIGNED NULL,
  observaciones  TEXT NULL,
  estado         ENUM('preparacion','en_curso','finalizado','cancelado') NOT NULL DEFAULT 'preparacion',
  creado_por     INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americanos_fecha (fecha),
  KEY idx_americanos_estado (estado),
  CONSTRAINT fk_americanos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/db/americanos_judex.sql.
CREATE TABLE americano_participantes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id   INT UNSIGNED NOT NULL,
  alumno_id      INT UNSIGNED NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_americano_alumno (americano_id, alumno_id),
  KEY idx_americano_participantes_alumno (alumno_id),
  CONSTRAINT fk_americano_participantes_americano FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_participantes_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/db/americanos_judex.sql.
CREATE TABLE americano_partidos (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id            INT UNSIGNED NOT NULL,
  ronda                   INT UNSIGNED NULL,
  orden                   INT UNSIGNED NULL,
  equipo_a_alumno_1_id    INT UNSIGNED NOT NULL,
  equipo_a_alumno_2_id    INT UNSIGNED NULL,
  equipo_b_alumno_1_id    INT UNSIGNED NOT NULL,
  equipo_b_alumno_2_id    INT UNSIGNED NULL,
  puntos_a                INT NOT NULL DEFAULT 0,
  puntos_b                INT NOT NULL DEFAULT 0,
  estado                  ENUM('pendiente','jugado') NOT NULL DEFAULT 'pendiente',
  notas                   VARCHAR(255) NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_partidos_americano (americano_id, ronda, orden),
  CONSTRAINT fk_americano_partidos_americano FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_a1 FOREIGN KEY (equipo_a_alumno_1_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_a2 FOREIGN KEY (equipo_a_alumno_2_id) REFERENCES alumnos(id) ON DELETE SET NULL,
  CONSTRAINT fk_americano_partidos_b1 FOREIGN KEY (equipo_b_alumno_1_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_partidos_b2 FOREIGN KEY (equipo_b_alumno_2_id) REFERENCES alumnos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/sql/2026-06-03_americano_gestion.sql.
-- [INCOMPATIBILIDAD] id y americano_id pasan de INT (con signo) a INT
-- UNSIGNED para coincidir con torneos_americanos.id (ver cabecera, punto 2).
CREATE TABLE americano_parejas (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id        INT UNSIGNED NOT NULL,
  jugador1_alumno_id  INT UNSIGNED NOT NULL,
  jugador2_alumno_id  INT UNSIGNED NULL,
  jugador1_nombre     VARCHAR(180) NULL,
  jugador2_nombre     VARCHAR(180) NULL,
  estado              ENUM('activa','baja','reserva') NOT NULL DEFAULT 'activa',
  notas               VARCHAR(255) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_parejas_americano (americano_id),
  KEY idx_americano_parejas_jugador1 (jugador1_alumno_id),
  KEY idx_americano_parejas_jugador2 (jugador2_alumno_id),
  CONSTRAINT fk_americano_parejas_americano FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_parejas_jugador1 FOREIGN KEY (jugador1_alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_parejas_jugador2 FOREIGN KEY (jugador2_alumno_id) REFERENCES alumnos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/sql/2026-06-03_americano_gestion.sql.
-- [INCOMPATIBILIDAD] id y americano_id pasan de INT (con signo) a INT
-- UNSIGNED, igual que americano_parejas (ver cabecera, punto 2).
CREATE TABLE americano_incidencias (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  americano_id   INT UNSIGNED NOT NULL,
  partido_id     INT UNSIGNED NULL,
  pareja_id      INT UNSIGNED NULL,
  tipo           ENUM('horario','pista','lesion','ausencia','organizacion','otro') NOT NULL DEFAULT 'otro',
  titulo         VARCHAR(180) NOT NULL,
  descripcion    TEXT NULL,
  estado         ENUM('abierta','resuelta') NOT NULL DEFAULT 'abierta',
  creado_por     INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_americano_incidencias_americano (americano_id),
  KEY idx_americano_incidencias_estado (estado),
  CONSTRAINT fk_americano_incidencias_americano FOREIGN KEY (americano_id) REFERENCES torneos_americanos(id) ON DELETE CASCADE,
  CONSTRAINT fk_americano_incidencias_partido FOREIGN KEY (partido_id) REFERENCES americano_partidos(id) ON DELETE SET NULL,
  CONSTRAINT fk_americano_incidencias_pareja FOREIGN KEY (pareja_id) REFERENCES americano_parejas(id) ON DELETE SET NULL,
  CONSTRAINT fk_americano_incidencias_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 5: GALERÍA DE FOTOS
-- =====================================================================

-- [CONFIRMADO] Exacta de backend/db/galeria_fotos.sql (id sube a INT
-- UNSIGNED por consistencia con el resto del esquema; no es un cambio de
-- comportamiento, el original no era UNSIGNED pero tampoco se esperaban
-- ids negativos).
CREATE TABLE galeria_fotos (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id         INT UNSIGNED NULL,
  titulo             VARCHAR(150) NOT NULL,
  descripcion        TEXT NULL,
  categoria          VARCHAR(80) NOT NULL DEFAULT 'Otros',
  archivo_url        VARCHAR(500) NOT NULL,
  archivo_nombre     VARCHAR(255) NULL,
  estado             ENUM('pendiente','aprobada','rechazada','eliminada') NOT NULL DEFAULT 'pendiente',
  motivo_rechazo     TEXT NULL,
  aprobado_por       INT UNSIGNED NULL,
  fecha_aprobacion   DATETIME NULL,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_galeria_estado (estado),
  KEY idx_galeria_categoria (categoria),
  KEY idx_galeria_usuario (usuario_id),
  CONSTRAINT fk_galeria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_galeria_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 6: NOTIFICACIONES
-- =====================================================================

-- [CONFIRMADO] Columnas de backend/db/notificaciones.sql.
-- [INCOMPATIBILIDAD] in_app_enabled pasa a DEFAULT 1: el CREATE TABLE
-- original decía DEFAULT 0, pero la migración de compatibilidad
-- (2026-05-24) y notificationService.js (que SIEMPRE inserta 1 en esta
-- columna) coinciden en que el comportamiento real es "activado por
-- defecto". Ver cabecera, punto 5.
CREATE TABLE notification_preferences (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id           INT UNSIGNED NOT NULL,
  email_enabled        TINYINT(1) NOT NULL DEFAULT 1,
  whatsapp_enabled     TINYINT(1) NOT NULL DEFAULT 0,
  in_app_enabled       TINYINT(1) NOT NULL DEFAULT 1,
  notify_reservas      TINYINT(1) NOT NULL DEFAULT 1,
  notify_clases        TINYINT(1) NOT NULL DEFAULT 1,
  notify_club          TINYINT(1) NOT NULL DEFAULT 1,
  notify_torneos       TINYINT(1) NOT NULL DEFAULT 1,
  whatsapp_phone       VARCHAR(30) NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_preferences_user (usuario_id),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Combina backend/db/notificaciones.sql +
-- backend/sql/2026-05-24_notifications_compatibility.sql
-- (referencia_tipo, referencia_id, read_at, sent_at, error_message,
-- provider_message_id, payload, created_by_user_id), todas usadas de
-- forma activa en services/notificationService.js.
CREATE TABLE notifications (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id            INT UNSIGNED NOT NULL,
  tipo                  VARCHAR(60) NOT NULL,
  canal                 ENUM('email','whatsapp','in_app') NOT NULL,
  titulo                VARCHAR(180) NOT NULL,
  mensaje               TEXT NOT NULL,
  referencia_tipo       VARCHAR(60) NULL,
  referencia_id         BIGINT UNSIGNED NULL,
  estado                ENUM('pending','sent','delivered','failed','skipped','unread','read') NOT NULL DEFAULT 'pending',
  read_at               DATETIME NULL,
  sent_at               DATETIME NULL,
  error_message         VARCHAR(500) NULL,
  provider_message_id   VARCHAR(180) NULL,
  payload               JSON NULL,
  created_by_user_id    INT UNSIGNED NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_created (usuario_id, created_at),
  KEY idx_notifications_user_channel_read (usuario_id, canal, read_at),
  KEY idx_notifications_status_channel (estado, canal),
  CONSTRAINT fk_notifications_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO estructura / NO USADA por el código actual] Exacta de
-- backend/db/notificaciones.sql. notifyEvent() no la consulta ni la
-- escribe hoy; se incluye porque formaba parte del diseño original. Si no
-- vas a usarla, puedes omitir este CREATE TABLE sin romper nada.
CREATE TABLE notification_templates (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type      VARCHAR(60) NOT NULL,
  channel         ENUM('email','whatsapp','in_app') NOT NULL,
  title_template  VARCHAR(180) NOT NULL,
  body_template   TEXT NOT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_templates_event_channel (event_type, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 7: WHATSAPP (bandeja + asistente para alumnos/familias)
-- =====================================================================

-- [CONFIRMADO] Exacta de backend/sql/2026-06-03_whatsapp_inbox.sql (id
-- sube a INT UNSIGNED por consistencia, igual que en galeria_fotos).
CREATE TABLE whatsapp_conversations (
  id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  wa_id                       VARCHAR(40) NOT NULL,
  telefono                    VARCHAR(40) NOT NULL,
  nombre_contacto             VARCHAR(180) NULL,
  estado                      ENUM('pendiente','abierta','atendida','cerrada') NOT NULL DEFAULT 'pendiente',
  ultimo_mensaje              TEXT NULL,
  ultimo_mensaje_en           DATETIME NULL,
  ultimo_mensaje_cliente_en   DATETIME NULL,
  ventana_24h_hasta           DATETIME NULL,
  atendido_por                INT UNSIGNED NULL,
  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_whatsapp_conversations_wa_id (wa_id),
  KEY idx_whatsapp_conversations_estado (estado),
  KEY idx_whatsapp_conversations_ultimo (ultimo_mensaje_en),
  CONSTRAINT fk_whatsapp_conversations_atendido_por FOREIGN KEY (atendido_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/sql/2026-06-03_whatsapp_inbox.sql.
CREATE TABLE whatsapp_messages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  meta_message_id VARCHAR(120) NULL,
  direccion       ENUM('inbound','outbound') NOT NULL,
  tipo            ENUM('text','template','image','audio','document','unknown') NOT NULL DEFAULT 'text',
  contenido       TEXT NULL,
  estado          ENUM('recibido','enviado','entregado','leido','error') NOT NULL DEFAULT 'recibido',
  error_message   TEXT NULL,
  raw_payload     JSON NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_messages_conversation (conversation_id),
  KEY idx_whatsapp_messages_meta_message (meta_message_id),
  CONSTRAINT fk_whatsapp_messages_conversation FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [CONFIRMADO] Exacta de backend/sql/2026-09-28_whatsapp_asistente_alumnos.sql.
-- [INCOMPATIBILIDAD] El fichero original dejaba la FK a alumnos comentada
-- ("tras confirmar que el tipo de alumno_id coincide con alumnos.id").
-- Con alumnos.id fijado aquí en INT UNSIGNED, se añade esa FK.
CREATE TABLE whatsapp_conversacion_alumno (
  conversation_id       INT UNSIGNED NOT NULL,
  alumno_id             INT UNSIGNED NULL,
  intencion_pendiente   VARCHAR(30) NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  KEY idx_whatsapp_conversacion_alumno_alumno (alumno_id),
  CONSTRAINT fk_whatsapp_conversacion_alumno_conversation FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_whatsapp_conversacion_alumno_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- BLOQUE 8: HARDWARE EXTERNO (no gestionado por este backend)
-- =====================================================================

-- [DECISIÓN / NO CONFIRMABLE POR CÓDIGO] Solo aparece en un SELECT de
-- solo lectura en backend/routes/asistente.js. La alimenta hardware
-- externo (sensor de pista del miniPC), no este backend. temperatura,
-- humedad y presion se proponen como DECIMAL por ser medidas con
-- decimales; ajusta la precisión si conoces el sensor real.
CREATE TABLE meteo_xiao (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  temperatura   DECIMAL(5,2) NULL,
  humedad       DECIMAL(5,2) NULL,
  presion       DECIMAL(6,2) NULL,
  estado        VARCHAR(40) NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meteo_xiao_creado_en (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- FIN. Próximos pasos sugeridos (no ejecutados aquí):
--   1) Revisar cada [DECISIÓN] contra lo que de verdad quieras para v2.
--   2) Si aceptas el esquema, créalo en un contenedor de prueba primero
--      ("docker run" con un volumen descartable) y haz pasar la suite de
--      backend/tests contra él antes de tocar nada real.
--   3) Solo entonces plantear migrar/crear la base definitiva.
-- =====================================================================
