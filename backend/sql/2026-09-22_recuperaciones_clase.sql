-- PROPUESTA PARA REVISAR EN LA BD REAL. No se ejecuta desde la aplicación.
-- Antes de aplicar, revisar SHOW CREATE TABLE recuperaciones_clase y sesiones_clase,
-- y los valores actuales de estado y motivo. Los campos existentes se conservan.
-- sesion_origen_id queda NULL para filas históricas que no se puedan vincular con certeza.

SHOW CREATE TABLE sesiones_clase;
SHOW CREATE TABLE recuperaciones_clase;
SELECT estado, COUNT(*) AS filas FROM recuperaciones_clase GROUP BY estado;
SELECT MAX(CHAR_LENGTH(motivo)) AS longitud_maxima_motivo FROM recuperaciones_clase;
SELECT alumno_id, grupo_id, fecha_original, COUNT(*) AS filas
FROM recuperaciones_clase
GROUP BY alumno_id, grupo_id, fecha_original
HAVING COUNT(*) > 1;

-- Detenerse aquí y revisar tipos/nulabilidad antes de ejecutar los ALTER siguientes.
-- Los INT de las nuevas columnas deben ajustarse al tipo real de sesiones_clase.id.
-- fecha_recuperacion debe admitir NULL para recuperaciones pendientes.

ALTER TABLE recuperaciones_clase
  ADD COLUMN sesion_origen_id INT NULL,
  ADD COLUMN sesion_recuperacion_id INT NULL;

-- Confirmar antes que los estados actuales son compatibles con estos cuatro valores.
ALTER TABLE recuperaciones_clase
  MODIFY COLUMN estado ENUM('pendiente', 'asignada', 'recuperada', 'cancelada')
    NOT NULL DEFAULT 'pendiente',
  MODIFY COLUMN motivo VARCHAR(255) NULL;

-- La unicidad permite varios NULL históricos, pero solo una fila por alumno/sesión nueva.
ALTER TABLE recuperaciones_clase
  ADD UNIQUE KEY uq_recuperacion_alumno_origen (alumno_id, sesion_origen_id),
  ADD KEY idx_recuperacion_sesion_destino (sesion_recuperacion_id);

-- Revisar opcionalmente filas antiguas con sesion_origen_id NULL para un backfill manual.
-- No se enlazan automáticamente: alumno/grupo/fecha podrían no identificar una sola sesión.
SELECT r.id AS recuperacion_id, r.alumno_id, r.grupo_id, r.fecha_original,
       s.id AS posible_sesion_origen_id
FROM recuperaciones_clase r
LEFT JOIN sesiones_clase s ON s.grupo_id = r.grupo_id AND s.fecha = r.fecha_original
WHERE r.sesion_origen_id IS NULL;
