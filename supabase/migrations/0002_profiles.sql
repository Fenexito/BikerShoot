-- Ejecutar en el SQL editor de Supabase (después de la 0001)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('biker', 'photographer', 'admin')),
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "cada quien ve su propio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "cada quien edita su propio perfil" on public.profiles
  for update using (auth.uid() = id);

-- Crea automáticamente el perfil al registrarse, leyendo role/display_name
-- de los metadatos que se mandan en supabase.auth.signUp({ options: { data: {...} } })
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'biker'),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
