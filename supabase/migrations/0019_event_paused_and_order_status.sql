-- Agrega el estado "pausado" para eventos (visible solo al fotógrafo dueño,
-- oculto de toda búsqueda/mapa/perfil público — ver src/features/biker/usePublicData.ts)
-- y simplifica el pipeline de pedidos de 5 estados a 4, fusionando 'activo' y
-- 'finalizado' (no tenían ninguna distinción funcional en el código) en un
-- solo 'en_preparacion'.
--
-- Orden correcto para order_items: quitar el constraint viejo, migrar los
-- datos SIN ningún constraint activo, y solo entonces agregar el nuevo —
-- un ADD CONSTRAINT valida todas las filas existentes en el momento, así
-- que agregarlo antes de limpiar los datos también falla (como pasó).

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('activo', 'pausado', 'cerrado'));

alter table public.order_items drop constraint if exists order_items_status_check;

update public.order_items set status = 'en_preparacion' where status in ('activo', 'finalizado');

alter table public.order_items add constraint order_items_status_check
  check (status in ('pendiente_pago', 'en_preparacion', 'entregado', 'cancelado'));
