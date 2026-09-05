-- Sistema de notificaciones categorizadas. Las filas SOLO se crean por
-- triggers (funciones security definer) — no hay policy de insert para
-- clientes, así ningún usuario puede fabricar una notificación falsa o
-- notificar a otra persona directamente.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'pedido_nuevo',
    'pedido_entregado',
    'pedido_cancelado',
    'fotografo_aprobado'
  )),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "ve sus propias notificaciones" on public.notifications;
create policy "ve sus propias notificaciones" on public.notifications
  for select using (auth.uid() = recipient_id);

drop policy if exists "marca sus notificaciones como leidas" on public.notifications;
create policy "marca sus notificaciones como leidas" on public.notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- ---------- Pedido nuevo: notifica a cada fotógrafo involucrado ----------
-- Statement-level (no por fila) para no duplicar cuando un mismo pedido trae
-- varias fotos del mismo fotógrafo — se agrupa por (order_id, photographer_id).
create or replace function public.notify_new_order_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, body, link)
  select
    grp.photographer_id,
    'pedido_nuevo',
    'Nuevo pedido de ' || coalesce(biker.display_name, 'un biker'),
    grp.item_count || ' foto' || (case when grp.item_count > 1 then 's' else '' end) || ' · Q' || grp.total,
    '/studio/pedidos/' || grp.order_id
  from (
    select order_id, photographer_id, count(*) as item_count, sum(price) as total
    from new_table
    group by order_id, photographer_id
  ) grp
  join public.orders o on o.id = grp.order_id
  left join public.profiles biker on biker.id = o.biker_id;
  return null;
end;
$$;

drop trigger if exists trg_notify_new_order_items on public.order_items;
create trigger trg_notify_new_order_items
  after insert on public.order_items
  referencing new table as new_table
  for each statement
  execute function public.notify_new_order_items();

-- ---------- Entrega / cancelación: notifica al biker dueño del pedido ----------
create or replace function public.notify_order_item_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biker_id uuid;
  v_event_title text;
begin
  if new.status = old.status then
    return null;
  end if;

  if new.status not in ('entregado', 'cancelado') then
    return null;
  end if;

  select o.biker_id into v_biker_id from public.orders o where o.id = new.order_id;
  select e.title into v_event_title from public.events e where e.id = new.event_id;

  if v_biker_id is null then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    v_biker_id,
    case when new.status = 'entregado' then 'pedido_entregado' else 'pedido_cancelado' end,
    case when new.status = 'entregado' then 'Tu foto ya está lista' else 'Un pedido fue cancelado' end,
    coalesce(v_event_title, 'Tu pedido'),
    '/app/historial'
  );
  return null;
end;
$$;

drop trigger if exists trg_notify_order_item_status on public.order_items;
create trigger trg_notify_order_item_status
  after update on public.order_items
  for each row
  execute function public.notify_order_item_status_change();

-- ---------- Aprobación de fotógrafo por un admin ----------
create or replace function public.notify_photographer_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved = true and (old.approved is distinct from true) then
    insert into public.notifications (recipient_id, type, title, body, link)
    values (new.profile_id, 'fotografo_aprobado', '¡Tu cuenta fue aprobada!', 'Ya puedes publicar eventos y vender fotos.', '/studio');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_photographer_approved on public.photographer_details;
create trigger trg_notify_photographer_approved
  after update on public.photographer_details
  for each row
  execute function public.notify_photographer_approved();
