-- Ejecutar en el SQL editor de Supabase (después de la 0007)
-- Agrega: tamaño de archivo por foto (para medir uso real de storage),
-- planes de almacenamiento, y el plan asignado a cada fotógrafo.

alter table public.photos add column if not exists size_bytes bigint not null default 0;

create table if not exists public.storage_plans (
  id text primary key,
  name text not null,
  gb_limit integer not null,
  price_monthly_gtq numeric not null,
  sort_order integer not null
);

alter table public.storage_plans enable row level security;

drop policy if exists "cualquiera ve los planes" on public.storage_plans;
create policy "cualquiera ve los planes" on public.storage_plans
  for select using (true);

insert into public.storage_plans (id, name, gb_limit, price_monthly_gtq, sort_order) values
  ('gratis', 'Gratis', 2, 0, 1),
  ('basico', 'Básico', 20, 49, 2),
  ('pro', 'Pro', 100, 149, 3),
  ('estudio', 'Estudio', 500, 399, 4)
on conflict (id) do update set
  name = excluded.name,
  gb_limit = excluded.gb_limit,
  price_monthly_gtq = excluded.price_monthly_gtq,
  sort_order = excluded.sort_order;

alter table public.photographer_details add column if not exists storage_plan_id text not null default 'gratis' references public.storage_plans(id);

drop policy if exists "admin actualiza plan de fotografos" on public.photographer_details;
create policy "admin actualiza plan de fotografos" on public.photographer_details
  for update using (public.is_admin());
