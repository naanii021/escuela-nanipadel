-- BORRADOR PARA REVISAR. NO se ha ejecutado y la aplicación no lo ejecuta.
-- Varios profesores por grupo ("clases compartidas"), p. ej. «Niños competición · Dani y Juanjo».
-- Ejecutar a mano. No usa DROP, DELETE ni TRUNCATE y se puede repetir sin efectos dobles.
--
-- Cómo aplicarla (haz antes una copia: scripts/backup-mysql.sh). La contraseña la pide mysql;
-- no la escribas en la línea de comandos:
--   docker exec -i nanipadel-mysql mysql -u root -p escuela_nani_padel_v2 < backend/sql/2026-11-12_grupo_profesores.sql
--
-- Efecto en el código: backend/services/profesoresGrupo.js detecta la tabla (una vez por proceso,
-- así que hay que REINICIAR el backend y el bot de Telegram después de aplicarla).
--  - Sin la tabla, todo funciona como hasta ahora con `grupos.profesor_id`.
--  - Con la tabla, un profesor pertenece al grupo si está en `grupo_profesores` O es `grupos.profesor_id`.
--    `grupos.profesor_id` sigue siendo el profesor principal (el primero de la lista).

-- 1) Comprobación previa: tiene que devolver 0 filas (la tabla aún no existe).
SHOW TABLES LIKE 'grupo_profesores';

-- 2) Tabla. grupos.id y profesores.id son INT UNSIGNED.
CREATE TABLE IF NOT EXISTS grupo_profesores (
  grupo_id INT UNSIGNED NOT NULL,
  profesor_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grupo_id, profesor_id),
  KEY idx_grupo_profesores_profesor (profesor_id),
  CONSTRAINT fk_grupo_profesores_grupo
    FOREIGN KEY (grupo_id) REFERENCES grupos (id) ON DELETE CASCADE,
  CONSTRAINT fk_grupo_profesores_profesor
    FOREIGN KEY (profesor_id) REFERENCES profesores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Siembra: cada grupo con profesor principal lo tiene también en la tabla.
INSERT IGNORE INTO grupo_profesores (grupo_id, profesor_id)
SELECT id, profesor_id FROM grupos WHERE profesor_id IS NOT NULL;

-- 4) Comprobación: una fila por grupo con profesor.
SELECT COUNT(*) AS filas FROM grupo_profesores;

-- 5) Ejemplo: añadir a Juanjo (profesor 3) al grupo «Niños competición · Dani y Juanjo».
--    Mejor desde la web (Gestión > grupos > profesores). Si lo haces a mano, busca antes el id del grupo:
-- SELECT id, nombre FROM grupos WHERE nombre LIKE 'Niños competición%';
-- INSERT IGNORE INTO grupo_profesores (grupo_id, profesor_id) VALUES (<id_del_grupo>, 3);
