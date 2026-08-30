-- Ejecutar en el SQL editor de Supabase (después de la 0013)
-- El watermark deja de generarse automáticamente con texto — ahora es un
-- PNG que el fotógrafo sube, por evento (puede tener uno distinto por
-- punto/evento). Si no sube ninguno, las fotos de ese evento se suben
-- reducidas igual, pero sin ninguna marca de agua encima.

alter table public.events add column if not exists watermark_path text;
