-- Ejecutar en el SQL editor de Supabase (después de la 0015)
-- El fotógrafo puede marcar fotos como "destacadas" para curar la galería
-- que se muestra en su perfil público (en vez de mostrar TODAS sus fotos).

alter table public.photos add column if not exists featured boolean not null default false;
