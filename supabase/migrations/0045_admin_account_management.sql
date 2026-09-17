-- Panel de admin para gestionar cuentas: vincular un biker con su cuenta
-- de fotógrafo (mismo humano, dos cuentas separadas — el modelo actual es
-- un profile = un rol, no se fusionan) y cambiar el rol de una cuenta.
-- Cambiar el rol a mano necesita crear la fila de detalle que falte
-- (biker_details/photographer_details, hoy solo las crea el trigger de
-- alta) — por eso va en una función security definer en vez de un simple
-- UPDATE desde el cliente.

alter table public.profiles add column if not exists linked_profile_id uuid references public.profiles(id) on delete set null;

create or replace function public.admin_set_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede cambiar el rol de una cuenta';
  end if;
  if new_role not in ('biker', 'photographer', 'admin') then
    raise exception 'Rol inválido: %', new_role;
  end if;

  update public.profiles set role = new_role where id = target_id;

  if new_role = 'photographer' then
    insert into public.photographer_details (profile_id) values (target_id)
    on conflict (profile_id) do nothing;
  elsif new_role = 'biker' then
    insert into public.biker_details (profile_id) values (target_id)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- Vincular es simétrico: ambos perfiles se apuntan entre sí, así cualquiera
-- de los dos lados muestra el vínculo.
create or replace function public.admin_link_profiles(profile_a uuid, profile_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede vincular cuentas';
  end if;
  if profile_a = profile_b then
    raise exception 'Una cuenta no puede vincularse consigo misma';
  end if;

  update public.profiles set linked_profile_id = profile_b where id = profile_a;
  update public.profiles set linked_profile_id = profile_a where id = profile_b;
end;
$$;

grant execute on function public.admin_link_profiles(uuid, uuid) to authenticated;

create or replace function public.admin_unlink_profile(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  other_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede desvincular cuentas';
  end if;

  select linked_profile_id into other_id from public.profiles where id = target_id;

  update public.profiles set linked_profile_id = null where id = target_id;
  if other_id is not null then
    update public.profiles set linked_profile_id = null where id = other_id;
  end if;
end;
$$;

grant execute on function public.admin_unlink_profile(uuid) to authenticated;
