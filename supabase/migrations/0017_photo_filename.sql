-- Ejecutar en el SQL editor de Supabase (después de la 0016)
-- Guarda el nombre de archivo original de cada foto — lo necesita el
-- fotógrafo para encontrarla en su propia cámara/computadora cuando le
-- llega un pedido (ver Grupo F del checklist de Studio).

alter table public.photos add column if not exists original_filename text;
