-- Renombra la categoría de evento "Pista" a "Autódromo" — el término que
-- los fotógrafos y bikers reconocen mejor (ver 0011 para el origen de
-- Rodada/Pista/Sesión de Fotos). El constraint se amplía PRIMERO (para
-- permitir 'Autódromo' junto a 'Pista' mientras se migran los datos) y
-- se cierra al final — hacerlo al revés (actualizar y luego mover el
-- constraint) falla: la fila con 'Autódromo' viola la regla vieja antes
-- de llegar a angostarla.

alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check check (category in ('Rodada', 'Pista', 'Autódromo', 'Sesión de Fotos'));

update public.events set category = 'Autódromo' where category = 'Pista';

alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check check (category in ('Rodada', 'Autódromo', 'Sesión de Fotos'));
