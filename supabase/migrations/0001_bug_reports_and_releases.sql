-- Ejecutar en el SQL editor de Supabase (proyecto motoshots-v2)

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references auth.users(id) on delete set null,
  page text not null check (page in ('publico','app-biker','studio-fotografo','admin','otro')),
  route text not null,
  kind text not null check (kind in ('visual','funcional','rendimiento','datos','otro')),
  description text not null,
  screenshot_url text,
  status text not null default 'abierto' check (status in ('abierto','en_progreso','resuelto','descartado'))
);

alter table public.bug_reports enable row level security;

create policy "cualquiera autenticado puede reportar" on public.bug_reports
  for insert to authenticated with check (true);

create policy "solo admin lee y edita reportes" on public.bug_reports
  for select using (auth.jwt() ->> 'role' = 'admin');

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  released_at timestamptz not null default now(),
  author text not null,
  notes text not null default '',
  highlights text[] not null default '{}'
);

alter table public.releases enable row level security;

create policy "todos pueden leer el changelog" on public.releases
  for select using (true);

create policy "solo admin escribe releases" on public.releases
  for insert with check (auth.jwt() ->> 'role' = 'admin');
