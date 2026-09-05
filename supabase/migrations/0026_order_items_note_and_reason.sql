-- Nota interna del fotógrafo sobre su parte de un pedido (nunca visible al
-- biker — vive en order_items, que ya tiene RLS que solo deja leer/escribir
-- al fotógrafo dueño de cada fila) y la razón que dio al cancelar.
alter table public.order_items add column if not exists photographer_note text;
alter table public.order_items add column if not exists cancellation_reason text;

-- Sellos de tiempo para la línea de tiempo del pedido — no existían antes,
-- solo el estado actual. Pedidos viejos quedan sin estos datos (se muestran
-- como "sin fecha registrada" en la UI); todo cambio nuevo sí los llena.
alter table public.order_items add column if not exists paid_at timestamptz;
alter table public.order_items add column if not exists delivered_at timestamptz;
alter table public.order_items add column if not exists cancelled_at timestamptz;
