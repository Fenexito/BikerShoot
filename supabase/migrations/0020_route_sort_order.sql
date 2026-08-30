-- Orden fijo de rutas en los selectores (antes se mostraban alfabéticas).
alter table public.routes add column if not exists sort_order int not null default 99;

update public.routes set sort_order = 1 where name = 'Ruta Interamericana (Tecpan)';
update public.routes set sort_order = 2 where name = 'RN14';
update public.routes set sort_order = 3 where name = 'Cañas';
update public.routes set sort_order = 4 where name = 'Carretera a El Salvador';
update public.routes set sort_order = 5 where name = 'Carretera al Atlántico';
