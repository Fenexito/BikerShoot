-- Logo PNG opcional del fotógrafo — cuando existe, reemplaza el nombre en
-- texto que se desvanece sobre la animación de portada (ScrollExpand) por
-- el logo real, en su perfil público y en el suyo propio del Studio.
alter table public.photographer_details add column if not exists logo_path text;
