-- Ejecutar manualmente en MySQL del miniPC antes de usar la configuración avanzada de formatos.
-- No ejecutar desde el portátil ni desde el frontend. Revisar primero la estructura real de la tabla torneos.

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS tipo_torneo VARCHAR(50) NOT NULL DEFAULT 'americano' AFTER modalidad,
  ADD COLUMN IF NOT EXISTS configuracion_formato JSON NULL AFTER tipo_torneo,
  ADD COLUMN IF NOT EXISTS plazas_maximas INT NULL AFTER max_parejas,
  ADD COLUMN IF NOT EXISTS pistas_necesarias INT NULL AFTER plazas_maximas,
  ADD COLUMN IF NOT EXISTS cartel_url VARCHAR(500) NULL AFTER pistas_necesarias;
