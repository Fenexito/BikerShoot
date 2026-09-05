-- Incluye el motivo de cancelación en la notificación al biker — antes solo
-- decía "Un pedido fue cancelado" sin explicar por qué. Reemplaza la función
-- de la migración 0025 (mismo trigger, no se toca).
create or replace function public.notify_order_item_status_change()
returns trigger
language plpgsql
security definer set search_path = public
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
    case
      when new.status = 'cancelado' and new.cancellation_reason is not null
        then coalesce(v_event_title, 'Tu pedido') || ' — motivo: ' || new.cancellation_reason
      else coalesce(v_event_title, 'Tu pedido')
    end,
    '/app/historial'
  );
  return null;
end;
$$;
