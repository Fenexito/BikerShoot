-- Pago por transferencia con comprobante: el fotógrafo publica sus datos
-- bancarios, el biker transfiere directo a su cuenta (como ya venía
-- haciendo por fuera de la app) y sube la captura del comprobante desde
-- aquí — eso es lo que el fotógrafo ve en su panel para confirmar el pago
-- y empezar a preparar las fotos.

alter table public.photographer_details add column if not exists bank_name text;
alter table public.photographer_details add column if not exists bank_account_holder text;
alter table public.photographer_details add column if not exists bank_account_number text;
alter table public.photographer_details add column if not exists bank_account_type text;

-- Un comprobante por (pedido, fotógrafo) — un pedido con varios
-- fotógrafos necesita una transferencia y un comprobante por cada uno,
-- nunca uno solo combinado.
create table if not exists public.order_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  photographer_id uuid not null references public.profiles(id),
  proof_path text not null,
  uploaded_at timestamptz not null default now(),
  unique (order_id, photographer_id)
);

alter table public.order_payment_proofs enable row level security;

drop policy if exists "biker administra comprobantes de sus pedidos" on public.order_payment_proofs;
create policy "biker administra comprobantes de sus pedidos" on public.order_payment_proofs
  for all using (
    exists (select 1 from public.orders o where o.id = order_payment_proofs.order_id and o.biker_id = auth.uid())
  )
  with check (
    exists (select 1 from public.orders o where o.id = order_payment_proofs.order_id and o.biker_id = auth.uid())
  );

drop policy if exists "fotografo ve comprobantes de sus pedidos" on public.order_payment_proofs;
create policy "fotografo ve comprobantes de sus pedidos" on public.order_payment_proofs
  for select using (auth.uid() = photographer_id);

create index if not exists order_payment_proofs_order_id_idx on public.order_payment_proofs(order_id);
create index if not exists order_payment_proofs_photographer_id_idx on public.order_payment_proofs(photographer_id);
