-- Ejecutar en el SQL editor de Supabase (después de la 0004)
-- Tablas reales para lo que ya construimos visualmente: eventos, puntos de
-- cobertura, fotos y pedidos. Las fotos en sí viven en Cloudflare R2 —
-- aquí solo guardamos storage_path (la ruta/key del archivo en el bucket).
--
-- Seguro de volver a correr completo (usa "if not exists" / "drop ... if
-- exists" antes de crear) por si una corrida anterior quedó a la mitad.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('Rodada', 'Pista', 'Exhibición', 'Concentración')),
  city text not null,
  venue text,
  event_date date not null,
  price_per_photo numeric not null check (price_per_photo >= 0),
  description text,
  status text not null default 'activo' check (status in ('activo', 'cerrado')),
  cover_path text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "cualquiera puede ver eventos" on public.events;
create policy "cualquiera puede ver eventos" on public.events
  for select using (true);

drop policy if exists "fotografo crea sus eventos" on public.events;
create policy "fotografo crea sus eventos" on public.events
  for insert with check (auth.uid() = photographer_id);

drop policy if exists "fotografo edita sus eventos" on public.events;
create policy "fotografo edita sus eventos" on public.events
  for update using (auth.uid() = photographer_id);

drop policy if exists "fotografo elimina sus eventos" on public.events;
create policy "fotografo elimina sus eventos" on public.events
  for delete using (auth.uid() = photographer_id);

create index if not exists events_photographer_id_idx on public.events(photographer_id);

-- ---------- Puntos de cobertura (mapa + horario) ----------
create table if not exists public.event_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  time_start time not null,
  time_end time not null,
  created_at timestamptz not null default now()
);

alter table public.event_points enable row level security;

drop policy if exists "cualquiera puede ver puntos" on public.event_points;
create policy "cualquiera puede ver puntos" on public.event_points
  for select using (true);

drop policy if exists "fotografo administra puntos de sus eventos" on public.event_points;
create policy "fotografo administra puntos de sus eventos" on public.event_points
  for all using (
    exists (select 1 from public.events e where e.id = event_points.event_id and e.photographer_id = auth.uid())
  );

create index if not exists event_points_event_id_idx on public.event_points(event_id);

-- ---------- Fotos ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  point_id uuid references public.event_points(id) on delete set null,
  storage_path text not null,
  price numeric not null check (price >= 0),
  moto_brand text,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

drop policy if exists "cualquiera puede ver fotos" on public.photos;
create policy "cualquiera puede ver fotos" on public.photos
  for select using (true);

drop policy if exists "fotografo administra sus fotos" on public.photos;
create policy "fotografo administra sus fotos" on public.photos
  for all using (auth.uid() = photographer_id);

create index if not exists photos_event_id_idx on public.photos(event_id);
create index if not exists photos_photographer_id_idx on public.photos(photographer_id);

-- ---------- Pedidos ----------
-- Un pedido es del biker; puede tener fotos de varios fotógrafos/eventos
-- (carrito mixto). Por eso el estado de cumplimiento vive en order_items,
-- no en orders — así cada fotógrafo avanza el estado de SU parte del
-- pedido sin tocar la de otro fotógrafo en el mismo carrito.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  biker_id uuid not null references public.profiles(id) on delete cascade,
  payment_method text not null check (payment_method in ('tarjeta', 'transferencia')),
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "biker ve sus pedidos" on public.orders;
create policy "biker ve sus pedidos" on public.orders
  for select using (auth.uid() = biker_id);

drop policy if exists "biker crea su pedido" on public.orders;
create policy "biker crea su pedido" on public.orders
  for insert with check (auth.uid() = biker_id);

-- ---------- Items del pedido (se crea antes de la policy de orders que lo referencia) ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  photo_id uuid not null references public.photos(id),
  photographer_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  price numeric not null check (price >= 0),
  status text not null default 'pendiente_pago' check (status in ('pendiente_pago', 'activo', 'finalizado', 'entregado', 'cancelado')),
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

drop policy if exists "biker ve items de sus pedidos" on public.order_items;
create policy "biker ve items de sus pedidos" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.biker_id = auth.uid())
  );

drop policy if exists "biker crea items en su pedido" on public.order_items;
create policy "biker crea items en su pedido" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.biker_id = auth.uid())
  );

drop policy if exists "fotografo ve sus items" on public.order_items;
create policy "fotografo ve sus items" on public.order_items
  for select using (auth.uid() = photographer_id);

drop policy if exists "fotografo actualiza estado de sus items" on public.order_items;
create policy "fotografo actualiza estado de sus items" on public.order_items
  for update using (auth.uid() = photographer_id);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_photographer_id_idx on public.order_items(photographer_id);

-- Ahora que order_items ya existe, agregamos la policy de orders que lo necesita.
drop policy if exists "fotografo ve pedidos con items suyos" on public.orders;
create policy "fotografo ve pedidos con items suyos" on public.orders
  for select using (
    exists (select 1 from public.order_items oi where oi.order_id = orders.id and oi.photographer_id = auth.uid())
  );

-- El fotógrafo necesita ver el perfil (nombre, avatar) del biker con quien
-- tiene un pedido — pero de ningún otro biker.
drop policy if exists "fotografo ve perfil de bikers con pedidos suyos" on public.profiles;
create policy "fotografo ve perfil de bikers con pedidos suyos" on public.profiles
  for select using (
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.biker_id = profiles.id and oi.photographer_id = auth.uid()
    )
  );
