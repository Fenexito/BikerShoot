-- Habilita eventos en tiempo real (DELETE/UPDATE) en public.photos — usados
-- por useSearchPhotosRealtimeSync (biker/usePublicData.ts) para refrescar
-- la búsqueda de fotos si un fotógrafo borra, mueve o reorganiza fotos
-- mientras el biker tiene resultados abiertos. Antes, un biker con
-- búsqueda activa (sin recargar la página, solo cambiando filtros)
-- seguía viendo fotos ya eliminadas o movidas de punto/horario — la
-- consulta de búsqueda se trae una sola vez y no había nada que la
-- invalidara cuando otro usuario cambiaba las fotos del lado del
-- fotógrafo. Mismo patrón que 0036_cart_items.sql.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
exception when undefined_object then
  null;
end $$;
