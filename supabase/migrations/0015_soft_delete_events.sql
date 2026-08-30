-- Ejecutar en el SQL editor de Supabase (después de la 0014)
-- Borrado suave de eventos: el fotógrafo puede "eliminar" un evento (lo
-- quita de su lista y de toda búsqueda/mapa/perfil público) sin que eso
-- nunca borre la fila real ni las fotos. order_items.photo_id no tiene
-- "on delete cascade" (el default de Postgres bloquea el borrado de una
-- foto ya vendida), así que un biker que ya compró sigue pudiendo
-- descargar su foto para siempre — "Mis compras" consulta order_items
-- directamente, nunca a través de las pantallas públicas que ahora
-- filtran por deleted_at.

alter table public.events add column if not exists deleted_at timestamptz;
