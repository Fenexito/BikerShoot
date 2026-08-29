-- Ejecutar en el SQL editor de Supabase (después de la 0008)
-- Las policies de bug_reports y releases de la migración 0001 usaban
-- auth.jwt() ->> 'role' = 'admin' — ese claim del JWT siempre vale
-- "authenticated" o "anon" (el rol de Postgres/PostgREST), nunca nuestro
-- rol de negocio guardado en profiles.role. Esas policies nunca hicieron
-- match. Se reemplazan por is_admin() (mismo patrón que ya usamos en
-- profiles/orders). También falta una policy de UPDATE en bug_reports
-- para que el admin pueda cambiar el estado de un reporte.

drop policy if exists "solo admin lee y edita reportes" on public.bug_reports;
create policy "admin lee reportes" on public.bug_reports
  for select using (public.is_admin());

drop policy if exists "admin actualiza reportes" on public.bug_reports;
create policy "admin actualiza reportes" on public.bug_reports
  for update using (public.is_admin());

drop policy if exists "solo admin escribe releases" on public.releases;
create policy "admin escribe releases" on public.releases
  for insert with check (public.is_admin());

drop policy if exists "admin actualiza releases" on public.releases;
create policy "admin actualiza releases" on public.releases
  for update using (public.is_admin());
