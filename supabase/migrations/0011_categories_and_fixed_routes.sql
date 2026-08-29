-- Ejecutar en el SQL editor de Supabase (después de la 0010)
-- Cambia las categorías de evento a Rodada / Pista / Sesión de Fotos, y
-- convierte "routes" en un catálogo fijo (5 rutas reales de Guatemala) que
-- ningún fotógrafo puede ampliar — solo pueden seguir creando route_points
-- (puntos) dentro de esas rutas ya existentes.

alter table public.events drop constraint if exists events_category_check;

update public.events set category = 'Sesión de Fotos' where category in ('Exhibición', 'Concentración');

alter table public.events add constraint events_category_check check (category in ('Rodada', 'Pista', 'Sesión de Fotos'));

-- Limpieza de la ruta de prueba creada durante desarrollo — las 5 rutas
-- reales de abajo son las únicas que deben existir de aquí en adelante.
delete from public.routes where name = 'Ruta a Tecpan Test';

insert into public.routes (name) values
  ('Ruta Interamericana (Tecpan)'),
  ('RN14'),
  ('Cañas'),
  ('Carretera a El Salvador'),
  ('Carretera al Atlántico')
on conflict (name) do nothing;

-- Las rutas ya no se crean desde la app — solo por este seed / admin directo.
drop policy if exists "usuario autenticado crea rutas" on public.routes;
