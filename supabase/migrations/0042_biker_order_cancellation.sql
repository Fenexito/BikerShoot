-- El biker ahora puede cancelar SU PARTE de un pedido (los order_items de UN
-- fotógrafo dentro de su pedido), pero solo mientras siga "pendiente_pago" —
-- una vez el fotógrafo confirma el pago (pasa a 'en_preparacion'), la
-- cancelación ya no es unilateral y debe acordarse directamente con el
-- fotógrafo (ver HistoryOrderDetail.tsx). El `using` exige que la fila YA
-- esté pendiente_pago (no se puede "revertir" una cancelación tampoco), y el
-- `with check` exige que el nuevo valor sea 'cancelado' — no le da al biker
-- ningún otro poder de edición sobre order_items.
drop policy if exists "biker cancela items pendientes de pago" on public.order_items;
create policy "biker cancela items pendientes de pago" on public.order_items
  for update using (
    status = 'pendiente_pago'
    and exists (select 1 from public.orders o where o.id = order_items.order_id and o.biker_id = auth.uid())
  )
  with check (
    status = 'cancelado'
    and exists (select 1 from public.orders o where o.id = order_items.order_id and o.biker_id = auth.uid())
  );

-- La notificación de cancelación asumía que siempre la origina el
-- fotógrafo (por eso siempre avisaba al biker) — ahora que el biker también
-- puede cancelar, si quien cancela es el propio biker se le avisa al
-- FOTÓGRAFO en su lugar (el biker no necesita que le notifiquen su propia
-- acción).
create or replace function public.notify_order_item_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_biker_id uuid;
  v_event_title text;
  v_recipient_id uuid;
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

  v_recipient_id := case when new.status = 'cancelado' and auth.uid() = v_biker_id then new.photographer_id else v_biker_id end;

  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    v_recipient_id,
    case when new.status = 'entregado' then 'pedido_entregado' else 'pedido_cancelado' end,
    case
      when new.status = 'entregado' then 'Tu foto ya está lista'
      when v_recipient_id <> v_biker_id then 'Un biker canceló un pedido'
      else 'Un pedido fue cancelado'
    end,
    case
      when new.status = 'cancelado' and new.cancellation_reason is not null
        then coalesce(v_event_title, 'Tu pedido') || ' — motivo: ' || new.cancellation_reason
      else coalesce(v_event_title, 'Tu pedido')
    end,
    case when v_recipient_id = v_biker_id then '/app/historial' else '/studio/pedidos' end
  );
  return null;
end;
$$;
