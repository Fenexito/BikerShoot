-- Ejecutar en el SQL editor de Supabase (después de la 0012)
-- Corrige el modelo de archivos por foto: storage_path (el "original"
-- obligatorio que se subía al crear el evento) fue un error de diseño —
-- en la vida real el fotógrafo nunca sube el 100% original en ese
-- momento. Ahora hay tres rutas posibles, todas opcionales salvo la del
-- preview:
--   preview_path   -> siempre existe, versión reducida + watermark (público)
--   raw_path       -> opcional, respaldo del original sin editar (privado)
--   delivered_path -> se llena DESPUÉS de la venta, cuando el fotógrafo
--                     sube el archivo final ya editado (privado) — esto es
--                     lo único que un biker puede llegar a descargar.

alter table public.photos alter column storage_path drop not null;
alter table public.photos add column if not exists raw_path text;
alter table public.photos add column if not exists delivered_path text;
