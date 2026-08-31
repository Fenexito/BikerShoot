-- Hash del contenido del archivo (SHA-256, calculado en el navegador antes
-- de subir) para poder detectar y rechazar fotos duplicadas dentro del
-- mismo evento — antes no había ninguna validación y el fotógrafo podía
-- subir la misma foto muchas veces.
alter table public.photos add column if not exists content_hash text;
create index if not exists photos_event_content_hash_idx on public.photos (event_id, content_hash);
