-- Miniatura chica (~360px) separada del preview (1600px, el que se vende) —
-- el visor del evento pinta muchas fotos a la vez (acordeón, cuadrícula
-- móvil, apilado de portada) y decodificar el preview completo para cada
-- una era justo lo que ponía lento el navegador. Se genera en el navegador
-- al subir (ver photoUpload.ts / PhotoUploadQueue.tsx) y se sube al mismo
-- bucket público que el preview — nunca contiene nada que el preview ya
-- no muestre, así que no hace falta protegerla aparte.

alter table public.photos add column if not exists thumbnail_path text;
