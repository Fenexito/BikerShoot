-- Ejecutar en el SQL editor de Supabase (después de la 0003)
-- Los proveedores OAuth (Google, etc.) no mandan "display_name" ni "role" en los
-- metadatos como lo hace nuestro signUp por email — mandan full_name/name/avatar_url.
-- Este trigger actualizado cubre ambos casos con un fallback sensato.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_name text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'biker');
  user_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );

  insert into public.profiles (id, role, display_name, avatar_url)
  values (new.id, user_role, user_name, new.raw_user_meta_data->>'avatar_url');

  if user_role = 'photographer' then
    insert into public.photographer_details (profile_id) values (new.id);
  elsif user_role = 'biker' then
    insert into public.biker_details (profile_id) values (new.id);
  end if;

  return new;
end;
$$;
