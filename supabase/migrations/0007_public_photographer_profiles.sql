-- Ejecutar en el SQL editor de Supabase (después de la 0006)
-- Hoy un biker no puede leer el perfil de ningún fotógrafo (profiles solo
-- se ve a uno mismo, o si eres admin, o si el fotógrafo tiene un pedido
-- contigo). Pero el nombre/bio/ciudad de un fotógrafo APROBADO son
-- justamente lo que un biker necesita ver al navegar eventos y perfiles
-- públicos — es información pública por diseño, no privada.

drop policy if exists "cualquiera ve perfiles de fotografos aprobados" on public.profiles;
create policy "cualquiera ve perfiles de fotografos aprobados" on public.profiles
  for select using (
    role = 'photographer'
    and exists (
      select 1 from public.photographer_details pd
      where pd.profile_id = profiles.id and pd.approved = true
    )
  );

drop policy if exists "cualquiera ve detalle de fotografos aprobados" on public.photographer_details;
create policy "cualquiera ve detalle de fotografos aprobados" on public.photographer_details
  for select using (approved = true);
