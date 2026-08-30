-- Ejecutar en el SQL editor de Supabase (después de la 0017)
-- Tamaños por versión de foto, granulares — hoy size_bytes es un solo
-- número combinado (preview+raw), lo que hace imposible saber cuánto
-- restar al liberar espacio de solo una de las dos versiones. size_bytes
-- no se toca (no se pierde nada), simplemente deja de ser la fuente de
-- verdad para el uso de almacenamiento a partir de ahora.

alter table public.photos add column if not exists preview_size_bytes bigint not null default 0;
alter table public.photos add column if not exists raw_size_bytes bigint not null default 0;
alter table public.photos add column if not exists delivered_size_bytes bigint not null default 0;

update public.photos set preview_size_bytes = size_bytes where preview_size_bytes = 0 and size_bytes > 0;
