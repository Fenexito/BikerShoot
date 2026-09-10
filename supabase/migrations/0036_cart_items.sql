-- Carrito sincronizado entre dispositivos: antes vivía solo en localStorage
-- (zustand persist), así que un biker que probaba desde el celular y desde
-- la computadora con la misma cuenta veía dos carritos distintos. Esta
-- tabla es la fuente de verdad del lado del servidor; el cliente sigue
-- usando su store local para que la UI responda al instante, y sincroniza
-- hacia/desde acá (ver `useCartSync.ts`).
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  event_id uuid not null,
  event_title text not null,
  photographer_id uuid not null,
  photographer_name text not null,
  price numeric not null,
  storage_path text,
  preview_path text,
  original_filename text,
  created_at timestamptz not null default now(),
  unique (profile_id, photo_id)
);

create index if not exists cart_items_profile_id_idx on public.cart_items (profile_id);

alter table public.cart_items enable row level security;

drop policy if exists "Users manage their own cart" on public.cart_items;
create policy "Users manage their own cart" on public.cart_items
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Habilita los eventos en tiempo real (INSERT/DELETE) que `useCartSync.ts`
-- escucha para reflejar en este dispositivo lo que se agregó/quitó desde
-- otro. Si el proyecto ya tiene esta tabla en la publicación (o la
-- publicación tiene "todas las tablas"), este bloque no hace nada.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cart_items'
  ) then
    alter publication supabase_realtime add table public.cart_items;
  end if;
exception when undefined_object then
  -- La publicación "supabase_realtime" no existe en este proyecto (poco
  -- común, pero posible en algunos setups) — sin ella el realtime de esta
  -- tabla no anda, pero la sincronización al abrir/cerrar la app sigue
  -- funcionando igual.
  null;
end $$;
