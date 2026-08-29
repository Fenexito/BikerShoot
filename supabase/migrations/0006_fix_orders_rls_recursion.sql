-- Ejecutar en el SQL editor de Supabase (después de la 0005)
-- Corrige recursion infinita: las policies de orders y order_items se
-- referenciaban entre si (orders -> order_items -> orders -> ...), lo que
-- Postgres no puede resolver y devuelve 500 en cualquier select a profiles
-- (que a su vez consulta order_items/orders). La solucion es la misma que
-- usamos con is_admin(): funciones security definer que consultan las
-- tablas SIN pasar de nuevo por sus policies de RLS, rompiendo el ciclo.

create or replace function public.photographer_has_order_item(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.order_items where order_id = p_order_id and photographer_id = auth.uid()
  );
$$;

create or replace function public.biker_owns_order(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders where id = p_order_id and biker_id = auth.uid()
  );
$$;

create or replace function public.photographer_has_order_with_biker(p_biker_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.biker_id = p_biker_id and oi.photographer_id = auth.uid()
  );
$$;

drop policy if exists "fotografo ve pedidos con items suyos" on public.orders;
create policy "fotografo ve pedidos con items suyos" on public.orders
  for select using (public.photographer_has_order_item(id));

drop policy if exists "biker ve items de sus pedidos" on public.order_items;
create policy "biker ve items de sus pedidos" on public.order_items
  for select using (public.biker_owns_order(order_id));

drop policy if exists "biker crea items en su pedido" on public.order_items;
create policy "biker crea items en su pedido" on public.order_items
  for insert with check (public.biker_owns_order(order_id));

drop policy if exists "fotografo ve perfil de bikers con pedidos suyos" on public.profiles;
create policy "fotografo ve perfil de bikers con pedidos suyos" on public.profiles
  for select using (public.photographer_has_order_with_biker(id));
