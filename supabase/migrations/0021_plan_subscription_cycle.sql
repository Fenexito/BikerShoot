-- Agrega el ciclo mensual del plan de almacenamiento: fecha de inicio del
-- ciclo actual, fecha de renovación, y un "plan pendiente" para cuando el
-- fotógrafo pide una reducción de plan (baja al final del ciclo, no de
-- inmediato, para no cortarle acceso a espacio que ya está usando).
--
-- Nota: todavía no hay pasarela de pago real conectada — este es el ciclo
-- de facturación mockeado (visual + fechas reales), consistente con el
-- resto de la app (mock del front-end antes de conectar el backend real).
-- La policy "fotografo edita su propio detalle" (0003) ya permite que el
-- fotógrafo actualice su propia fila, así que no hace falta una policy nueva.

alter table public.photographer_details add column if not exists plan_started_at timestamptz not null default now();
alter table public.photographer_details add column if not exists plan_renews_at timestamptz not null default (now() + interval '1 month');
alter table public.photographer_details add column if not exists pending_plan_id text references public.storage_plans(id);
