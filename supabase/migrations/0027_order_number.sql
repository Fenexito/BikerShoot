-- Número de pedido legible (#000938) en vez de solo el UUID interno — el
-- identificador real de unión sigue siendo order_id + photographer_id;
-- esto es puramente para que el fotógrafo y el biker tengan una referencia
-- corta que mencionar en soporte.
alter table public.orders add column if not exists order_number bigint generated always as identity;
