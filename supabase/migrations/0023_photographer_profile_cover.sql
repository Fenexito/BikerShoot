-- Foto de portada del perfil público del fotógrafo (banner detrás del avatar).
alter table public.photographer_details add column if not exists profile_cover_path text;
