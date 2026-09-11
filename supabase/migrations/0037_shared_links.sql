-- Enlaces cortos para "compartir foto" (biker envía una foto encontrada en
-- su búsqueda a un amigo). Guarda solo lo mínimo para reconstruir la
-- experiencia al abrir el link: qué foto resaltar y con qué filtros de
-- búsqueda se encontró — no hay nada sensible aquí, es información que
-- cualquiera podría reproducir manualmente buscando en la app.
create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  search_params text not null default '',
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shared_links_code_idx on public.shared_links(code);

alter table public.shared_links enable row level security;

-- Resolver un código es la operación que hace CUALQUIERA que reciba un
-- link (con o sin cuenta) — debe ser público, igual que la propia tabla
-- `photos` ("cualquiera puede ver fotos").
drop policy if exists "cualquiera puede resolver un link compartido" on public.shared_links;
create policy "cualquiera puede resolver un link compartido" on public.shared_links
  for select using (true);

-- Solo se CREAN links desde el visor de fotos, que ya requiere sesión
-- iniciada (vive dentro de /app, detrás de RequireBiker).
drop policy if exists "usuarios autenticados crean links compartidos" on public.shared_links;
create policy "usuarios autenticados crean links compartidos" on public.shared_links
  for insert with check (auth.uid() is not null);
