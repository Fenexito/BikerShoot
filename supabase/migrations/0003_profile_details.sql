-- Ejecutar en el SQL editor de Supabase (después de la 0002)

alter table public.profiles add column if not exists phone text;

-- Función auxiliar para chequear "soy admin" sin causar recursión en las policies
-- de la propia tabla profiles (security definer = corre sin pasar por RLS).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "admin ve todos los perfiles" on public.profiles
  for select using (public.is_admin());

create table if not exists public.biker_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  moto_brand text,
  moto_model text,
  city text
);

alter table public.biker_details enable row level security;

create policy "biker ve su propio detalle" on public.biker_details
  for select using (auth.uid() = profile_id);

create policy "biker edita su propio detalle" on public.biker_details
  for update using (auth.uid() = profile_id);

create table if not exists public.photographer_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  city text,
  whatsapp text,
  onboarding_completed boolean not null default false,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.photographer_details enable row level security;

create policy "fotografo ve su propio detalle" on public.photographer_details
  for select using (auth.uid() = profile_id);

create policy "fotografo edita su propio detalle" on public.photographer_details
  for update using (auth.uid() = profile_id);

-- Admin: puede ver y aprobar a cualquier fotógrafo
create policy "admin ve todos los fotografos" on public.photographer_details
  for select using (public.is_admin());

create policy "admin aprueba fotografos" on public.photographer_details
  for update using (public.is_admin());

-- Actualiza el trigger de creación de usuario para crear también el detalle por rol
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'biker');

  insert into public.profiles (id, role, display_name)
  values (new.id, user_role, coalesce(new.raw_user_meta_data->>'display_name', ''));

  if user_role = 'photographer' then
    insert into public.photographer_details (profile_id) values (new.id);
  elsif user_role = 'biker' then
    insert into public.biker_details (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

-- Para cuentas que ya existan sin fila de detalle (creadas antes de esta migración)
insert into public.biker_details (profile_id)
select id from public.profiles p
where p.role = 'biker' and not exists (select 1 from public.biker_details b where b.profile_id = p.id);

insert into public.photographer_details (profile_id)
select id from public.profiles p
where p.role = 'photographer' and not exists (select 1 from public.photographer_details d where d.profile_id = p.id);
