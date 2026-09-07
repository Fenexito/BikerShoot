-- Fragmentos de horario que el fotógrafo declara a mano para un punto (ej.
-- "6:00-6:15", "6:15-6:30"...) — se ofrecen como chips de selección rápida
-- al asignar manualmente la hora de fotos sin EXIF, para no tener que picar
-- una hora exacta cada vez. Array de objetos {start, end} en formato
-- "HH:MM", o null si el fotógrafo no configuró ninguno para ese punto.
alter table public.event_points add column if not exists manual_segments jsonb;
