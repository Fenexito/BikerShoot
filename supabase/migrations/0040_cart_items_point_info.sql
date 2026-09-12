-- El carrito ahora agrupa visualmente por fotógrafo → evento → punto, y
-- muestra el horario del punto junto al nombre del archivo — hace falta
-- guardar esa info también en la copia server-side del carrito
-- (`cart_items`, ver useCartSync.ts) para que sincronice igual entre
-- dispositivos.
alter table public.cart_items add column if not exists point_label text;
alter table public.cart_items add column if not exists point_time_start text;
alter table public.cart_items add column if not exists point_time_end text;
