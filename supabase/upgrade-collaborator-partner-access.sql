-- Explicit product permissions for collaborator partners.
create table if not exists public.collaborator_partner_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists collaborator_partner_products_user_idx
  on public.collaborator_partner_products(user_id);
create index if not exists collaborator_partner_products_product_idx
  on public.collaborator_partner_products(product_id);

alter table public.collaborator_partner_products enable row level security;

drop policy if exists "admins manage collaborator partner products" on public.collaborator_partner_products;
create policy "admins manage collaborator partner products"
on public.collaborator_partner_products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "collaborators read own product access" on public.collaborator_partner_products;
create policy "collaborators read own product access"
on public.collaborator_partner_products
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

grant select, insert, delete on public.collaborator_partner_products to authenticated;

-- Keep collaborator accounts visible to their own dashboard, while admins retain full control.
-- Product-level analytics are resolved server-side and never exposed for unauthorized products.
