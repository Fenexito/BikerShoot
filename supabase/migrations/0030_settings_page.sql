-- Apoya la nueva página de Configuración: un nickname explícito para el
-- sufijo del código de pedido (en vez de derivarlo siempre del nombre del
-- estudio), y preferencias de notificación por usuario (ambos portales).
alter table public.photographer_details add column if not exists order_nickname text;
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
