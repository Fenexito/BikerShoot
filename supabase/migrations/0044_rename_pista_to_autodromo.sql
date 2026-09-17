-- Renombra la categoría de evento "Pista" a "Autódromo" — el término que
-- los fotógrafos y bikers reconocen mejor (ver 0011 para el origen de
-- Rodada/Pista/Sesión de Fotos). Actualiza los eventos existentes antes de
-- mover el check constraint para no dejar filas que ya no cumplan la regla.

update public.events set category = 'Autódromo' where category = 'Pista';

alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check check (category in ('Rodada', 'Autódromo', 'Sesión de Fotos'));
