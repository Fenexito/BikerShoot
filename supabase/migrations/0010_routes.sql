-- Ejecutar en el SQL editor de Supabase (después de la 0009)
-- Introduce "rutas" (ej. Ruta a Tecpan) y "puntos de ruta" (ej. VP Racing)
-- como catálogo público y compartido entre fotógrafos. Antes, cada punto
-- de cobertura (event_points) pertenecía a un solo evento/fotógrafo con su
-- propio lat/lng capturado a mano — no había forma de que dos fotógrafos
-- distintos "compartieran" el mismo punto físico real. event_points
-- conserva sus columnas label/lat/lng tal cual (se copian del route_point
-- elegido al crear el punto) para no romper nada que ya lee esas columnas;
-- route_point_id es solo el nuevo enlace para agrupar/filtrar por ruta.

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.routes enable row level security;

drop policy if exists "cualquiera ve rutas" on public.routes;
create policy "cualquiera ve rutas" on public.routes
  for select using (true);

drop policy if exists "usuario autenticado crea rutas" on public.routes;
create policy "usuario autenticado crea rutas" on public.routes
  for insert with check (auth.uid() is not null);

create table if not exists public.route_points (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  unique (route_id, label)
);

alter table public.route_points enable row level security;

drop policy if exists "cualquiera ve puntos de ruta" on public.route_points;
create policy "cualquiera ve puntos de ruta" on public.route_points
  for select using (true);

drop policy if exists "usuario autenticado crea puntos de ruta" on public.route_points;
create policy "usuario autenticado crea puntos de ruta" on public.route_points
  for insert with check (auth.uid() is not null);

create index if not exists route_points_route_id_idx on public.route_points(route_id);

-- Nota: a propósito no hay policies de update/delete en routes/route_points.
-- El punto es compartido entre fotógrafos — ninguno debe poder editarlo o
-- borrarlo unilateralmente y romperlo para los demás que ya lo usan.

alter table public.event_points add column if not exists route_point_id uuid references public.route_points(id) on delete set null;
create index if not exists event_points_route_point_id_idx on public.event_points(route_point_id);
