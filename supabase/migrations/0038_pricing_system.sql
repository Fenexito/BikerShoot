-- Sistema de precios rediseñado (ver documento "Sistema de precios de
-- MotoShots", 2026-09-12): escalera de almacenamiento más granular +
-- add-ons de GB, extras à la carte, tabla de precios por volumen propia
-- de cada fotógrafo, tarifa de servicio fija por foto, y cortesías.

-- ---------- A. Escalera de almacenamiento ----------
-- 'basico' se queda igual (20GB/Q49) y 'pro' conserva el id (ahora
-- 100GB/Q119, antes 100GB/Q149) para no romper el storage_plan_id ya
-- asignado a fotógrafos existentes. 'estudio' baja de 500GB a 300GB — este
-- sistema todavía no tiene clientes de pago reales (billing mockeado), así
-- que es seguro ajustarlo.
alter table public.storage_plans add column if not exists max_active_events integer;

insert into public.storage_plans (id, name, gb_limit, price_monthly_gtq, sort_order, max_active_events) values
  ('gratis', 'Gratis', 2, 0, 1, 1),
  ('starter', 'Starter', 8, 25, 2, null),
  ('basico', 'Básico', 20, 49, 3, null),
  ('plus', 'Plus', 50, 85, 4, null),
  ('pro', 'Pro', 100, 119, 5, null),
  ('estudio', 'Estudio', 300, 259, 6, null)
on conflict (id) do update set
  name = excluded.name,
  gb_limit = excluded.gb_limit,
  price_monthly_gtq = excluded.price_monthly_gtq,
  sort_order = excluded.sort_order,
  max_active_events = excluded.max_active_events;

-- Add-ons de espacio — catálogo público, igual que storage_plans.
create table if not exists public.storage_addons (
  id text primary key,
  name text not null,
  gb integer not null,
  price_monthly_gtq numeric not null,
  sort_order integer not null
);

alter table public.storage_addons enable row level security;

drop policy if exists "cualquiera ve los add-ons de espacio" on public.storage_addons;
create policy "cualquiera ve los add-ons de espacio" on public.storage_addons
  for select using (true);

insert into public.storage_addons (id, name, gb, price_monthly_gtq, sort_order) values
  ('gb10', '+10 GB', 10, 18, 1),
  ('gb25', '+25 GB', 25, 40, 2)
on conflict (id) do update set
  name = excluded.name,
  gb = excluded.gb,
  price_monthly_gtq = excluded.price_monthly_gtq,
  sort_order = excluded.sort_order;

-- Extras à la carte (funciones nativas de un plan más alto, compradas
-- sueltas sobre uno más económico). `native_plan_id` es solo informativo
-- (para mostrar "incluido desde X" en la UI) — comprarlo suelto no
-- requiere estar en ningún plan en particular.
create table if not exists public.feature_addons (
  id text primary key,
  name text not null,
  price_monthly_gtq numeric not null,
  native_plan_id text references public.storage_plans(id),
  sort_order integer not null
);

alter table public.feature_addons enable row level security;

drop policy if exists "cualquiera ve los extras" on public.feature_addons;
create policy "cualquiera ve los extras" on public.feature_addons
  for select using (true);

insert into public.feature_addons (id, name, price_monthly_gtq, native_plan_id, sort_order) values
  ('analitica', 'Analítica de ventas', 12, 'plus', 1),
  ('verificado', 'Insignia verificado + prioridad de visibilidad', 12, 'plus', 2),
  ('marca_agua', 'Marca de agua personalizable', 15, 'pro', 3),
  ('soporte_prioritario', 'Soporte prioritario', 10, 'pro', 4),
  ('cortesias_ampliadas', 'Cortesías ampliadas', 10, 'pro', 5),
  ('colaborador_extra', 'Colaborador adicional', 30, 'estudio', 6)
on conflict (id) do update set
  name = excluded.name,
  price_monthly_gtq = excluded.price_monthly_gtq,
  native_plan_id = excluded.native_plan_id,
  sort_order = excluded.sort_order;

-- Qué add-ons/extras tiene activos cada fotógrafo — arrays simples de ids
-- de catálogo. El billing sigue siendo mockeado (igual que `storage_plan_id`
-- hoy), así que no hace falta una tabla de suscripciones aparte todavía.
alter table public.photographer_details add column if not exists storage_addon_ids text[] not null default '{}';
alter table public.photographer_details add column if not exists feature_addon_ids text[] not null default '{}';

-- ---------- C. Precio por volumen (tabla libre de cada fotógrafo) ----------
-- Reemplaza el 15% genérico anterior. `photo_count` = cuántas fotos DE ESE
-- fotógrafo trae el pedido (sin importar evento/punto), `total_price` = lo
-- que el biker paga en total por esa cantidad. Más allá del último
-- `photo_count` definido, el checkout extrapola con el ritmo marginal del
-- último salto (última fila menos penúltima) — eso vive en código, no aquí.
create table if not exists public.photographer_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  photo_count integer not null check (photo_count >= 1),
  total_price numeric not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  unique (photographer_id, photo_count)
);

alter table public.photographer_pricing_tiers enable row level security;

-- Pública para que el checkout del biker pueda calcular el total sin
-- necesitar una función aparte — mismo criterio que `photos`/`events`.
drop policy if exists "cualquiera ve las tablas de precio por volumen" on public.photographer_pricing_tiers;
create policy "cualquiera ve las tablas de precio por volumen" on public.photographer_pricing_tiers
  for select using (true);

drop policy if exists "fotografo administra su tabla de precios" on public.photographer_pricing_tiers;
create policy "fotografo administra su tabla de precios" on public.photographer_pricing_tiers
  for all using (auth.uid() = photographer_id) with check (auth.uid() = photographer_id);

create index if not exists photographer_pricing_tiers_photographer_id_idx on public.photographer_pricing_tiers(photographer_id);

-- ---------- D. Tarifa de servicio + E. Cortesías ----------
-- `service_fee`: Q2 fijo por foto (calculado sobre el precio individual de
-- la foto, antes del descuento por volumen), sumado al total que el biker
-- paga al fotógrafo. Se acumula sin liquidar (`service_fee_settled_at is
-- null`) hasta que se salda junto al plan del fotógrafo.
-- `is_courtesy`/`courtesy_type`: una foto regalada por el fotógrafo dentro
-- de un pedido real — 'waiver' (un item que el biker sí seleccionó, pero
-- el fotógrafo perdonó el cobro) o 'extra' (una foto que el fotógrafo
-- agregó de regalo, fuera de lo que el biker eligió). Ambas quedan en
-- price=0 y no generan tarifa de servicio.
alter table public.order_items add column if not exists service_fee numeric not null default 0;
alter table public.order_items add column if not exists service_fee_settled_at timestamptz;
alter table public.order_items add column if not exists is_courtesy boolean not null default false;
alter table public.order_items add column if not exists courtesy_type text check (courtesy_type in ('waiver', 'extra'));

-- El fotógrafo ya puede ACTUALIZAR sus propios order_items (ver migración
-- 0005, "fotografo actualiza estado de sus items") — eso alcanza para
-- aplicar un waiver. Para el tipo 'extra' hace falta poder INSERTAR un
-- item nuevo, solo dentro de un pedido donde ya tiene algo vendido (nunca
-- en un pedido ajeno donde no participa).
drop policy if exists "fotografo agrega cortesia a pedidos donde ya vende" on public.order_items;
create policy "fotografo agrega cortesia a pedidos donde ya vende" on public.order_items
  for insert with check (
    auth.uid() = photographer_id
    and exists (
      select 1 from public.order_items oi2
      where oi2.order_id = order_items.order_id and oi2.photographer_id = auth.uid()
    )
  );
