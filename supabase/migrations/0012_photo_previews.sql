-- Ejecutar en el SQL editor de Supabase (después de la 0011)
-- A partir de ahora una foto vive en DOS lugares: el original intacto en
-- un bucket privado de R2 (storage_path) y una versión reducida con marca
-- de agua en el bucket público (preview_path). Fotos ya subidas antes de
-- este cambio tendrán preview_path null — el front cae de vuelta a
-- storage_path (bucket público viejo) para esas, sin romper nada.

alter table public.photos add column if not exists preview_path text;
