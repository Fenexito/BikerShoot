-- Reintento aislado: verifiqué por API que "CAES" sí se renombró con la
-- 0034, pero "Ruta Interamericana (Tecpan)" seguía con su nombre viejo —
-- el string coincide exacto (revisado byte a byte), así que probablemente
-- esa línea específica no se ejecutó al correr la migración anterior.
-- Este archivo solo trae esa una línea, para que sea fácil confirmar que
-- corrió (verifica con: select name from routes where sort_order = 1;
-- debería mostrar "Tecpan").
update public.routes set name = 'Tecpan' where name = 'Ruta Interamericana (Tecpan)';
