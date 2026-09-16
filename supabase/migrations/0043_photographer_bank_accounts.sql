-- Antes solo existían 4 columnas escalares en `photographer_details` (una
-- sola cuenta bancaria posible, un "Editar" por campo). Se reemplaza por
-- una tabla propia que permite varias cuentas por fotógrafo (ej. dos
-- bancos distintos) y una foto opcional (captura de pantalla de los datos
-- de la cuenta) que el biker puede ver al pagar por transferencia.
--
-- Mismo nivel de exposición que hoy: `photographer_details` ya es legible
-- por cualquiera para un fotógrafo aprobado (0007_public_photographer_profiles.sql,
-- "approved = true"), así que esta tabla nueva copia ese mismo criterio en
-- vez de restringir más de lo que ya estaba.
--
-- Las 4 columnas viejas en `photographer_details` se dejan intactas (no se
-- leen más desde la UI nueva) — evita una migración destructiva; se migran
-- los datos existentes a la tabla nueva con un INSERT de una sola vez.

create table if not exists public.photographer_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  bank_name text,
  account_holder text,
  account_number text,
  account_type text,
  info_photo_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.photographer_bank_accounts enable row level security;

drop policy if exists "fotografo administra sus cuentas bancarias" on public.photographer_bank_accounts;
create policy "fotografo administra sus cuentas bancarias" on public.photographer_bank_accounts
  for all using (auth.uid() = photographer_id)
  with check (auth.uid() = photographer_id);

drop policy if exists "cualquiera ve cuentas de fotografos aprobados" on public.photographer_bank_accounts;
create policy "cualquiera ve cuentas de fotografos aprobados" on public.photographer_bank_accounts
  for select using (
    exists (
      select 1 from public.photographer_details d
      where d.profile_id = photographer_bank_accounts.photographer_id and d.approved = true
    )
  );

create index if not exists photographer_bank_accounts_photographer_id_idx on public.photographer_bank_accounts(photographer_id);

insert into public.photographer_bank_accounts (photographer_id, bank_name, account_holder, account_number, account_type)
select profile_id, bank_name, bank_account_holder, bank_account_number, bank_account_type
from public.photographer_details
where bank_name is not null;
