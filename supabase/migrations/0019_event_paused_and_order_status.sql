-- Agrega el estado "pausado" para eventos (visible solo al fotógrafo dueño,
-- oculto de toda búsqueda/mapa/perfil público — ver src/features/biker/usePublicData.ts)
-- y simplifica el pipeline de pedidos de 5 estados a 4, fusionando 'activo' y
-- 'finalizado' (no tenían ninguna distinción funcional en el código) en un
-- solo 'en_preparacion'.
--
-- Orden importa: el constraint tiene que ampliarse ANTES del UPDATE, si no
-- el UPDATE choca contra el constraint viejo que todavía no permite el
-- valor nuevo.

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('activo', 'pausado', 'cerrado'));

alter table public.order_items drop constraint if exists order_items_status_check;
alter table public.order_items add constraint order_items_status_check
  check (status in ('pendiente_pago', 'en_preparacion', 'entregado', 'cancelado'));

update public.order_items set status = 'en_preparacion' where status in ('activo', 'finalizado');
