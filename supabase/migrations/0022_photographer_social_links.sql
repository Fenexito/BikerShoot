-- Redes sociales del fotógrafo, visibles y clicables en su perfil público.
alter table public.photographer_details add column if not exists instagram_url text;
alter table public.photographer_details add column if not exists facebook_url text;
alter table public.photographer_details add column if not exists tiktok_url text;
