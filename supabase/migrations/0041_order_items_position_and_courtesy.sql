-- Dos problemas reales encontrados al usar el regalo de cortesías:
--
-- 1) `order_items` no tenía ninguna columna de orden explícito — Postgres
-- NO garantiza el orden de filas sin un `order by`, así que la lista de
-- fotos de un pedido podía "barajarse" sola entre un fetch y otro (el
-- usuario lo notó al regalar una foto o subir una entrega). `position` fija
-- el orden real de aparición, asignado una sola vez al crear cada fila.
--
-- 2) Regalar una foto (waiver) pisaba `price`/`service_fee` con 0 sin
-- guardar el valor original — no había forma de deshacerlo. `original_price`
-- y `original_service_fee` guardan ese valor para poder restaurarlo.
alter table public.order_items add column if not exists position integer not null default 0;
alter table public.order_items add column if not exists original_price numeric;
alter table public.order_items add column if not exists original_service_fee numeric;

-- Backfill para pedidos ya existentes: usa el orden actual (created_at,
-- luego id como desempate estable) como su `position` definitivo — no es
-- perfecto (no había orden real guardado), pero deja de barajarse a partir
-- de ahora.
with ranked as (
  select id, row_number() over (partition by order_id order by created_at, id) - 1 as rn
  from public.order_items
)
update public.order_items oi
set position = ranked.rn
from ranked
where oi.id = ranked.id and oi.position = 0;
