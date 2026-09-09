-- Renombra rutas a nombres más cortos para que quepan cómodo como pestañas
-- en el filtro de Eventos del biker (RN14/Cañas/Carretera al Atlántico se
-- quedan igual, ya eran cortos). Es idempotente: si el nombre ya cambió,
-- el UPDATE simplemente no encuentra filas y no hace nada.
update public.routes set name = 'Tecpan' where name = 'Ruta Interamericana (Tecpan)';
update public.routes set name = 'CAES' where name = 'Carretera a El Salvador';
