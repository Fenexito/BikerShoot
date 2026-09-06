-- Etiqueta legible de dónde vino el reporte (ej. "Detalle de evento (Studio)")
-- calculada en el cliente a partir de la ruta — la ruta cruda ya se guardaba
-- en `route`, esto solo la hace más fácil de leer sin tener que descifrar el
-- patrón de la URL a mano.
alter table public.bug_reports add column if not exists context_label text;
