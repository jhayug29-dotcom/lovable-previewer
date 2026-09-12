-- Editly Store — Collaborator production repair
-- IMPORTANT: Run this ONCE in the Supabase SQL Editor for the SAME project
-- used by the production site. The current production console shows requests
-- going to https://wylcbblegcyzunychqqa.supabase.co and returning
-- "Could not find the table 'public.collaborator_links' in the schema cache".
-- This script is safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ensure the collaborator link table exists
-- ---------------------------------------------------------------------------
create table if not exists public.collaborator_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. Ensure product-permission table exists
-- ---------------------------------------------------------------------------
create table if not exists public.collaborator_partner_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 3. Link attribution columns used by analytics / checkout
-- ---------------------------------------------------------------------------
alter table public.page_views
  add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;

alter table public.page_views
  add column if not exists collaborator_code text;

alter table public.page_views
  add column if not exists session_id text;

alter table public.orders
  add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;

create index if not exists collaborator_links_user_idx
  on public.collaborator_links(user_id);

create index if not exists collaborator_links_code_idx
  on public.collaborator_links(code);

create index if not exists collaborator_partner_products_user_idx
  on public.collaborator_partner_products(user_id);

create index if not exists collaborator_partner_products_product_idx
  on public.collaborator_partner_products(product_id);

create index if not exists page_views_collaborator_link_idx
  on public.page_views(collaborator_link_id);

create index if not exists page_views_collaborator_code_idx
  on public.page_views(collaborator_code);

create index if not exists orders_collaborator_link_idx
  on public.orders(collaborator_link_id);

-- ---------------------------------------------------------------------------
-- 4. Make Supabase RLS and the application's admin identity agree
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(auth.uid(), 'admin')
    or lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('growchannel2026@gmail.com');
$$;

-- Remove the optional old display-name uniqueness if it exists. Referral code
-- remains the real unique identifier.
alter table public.collaborator_links
drop constraint if exists collaborator_links_user_id_name_key;

-- ---------------------------------------------------------------------------
-- 5. RLS + grants for collaborator links
-- ---------------------------------------------------------------------------
alter table public.collaborator_links enable row level security;

drop policy if exists "admins manage collaborator links" on public.collaborator_links;
create policy "admins manage collaborator links"
on public.collaborator_links
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned users read collaborator links" on public.collaborator_links;
create policy "assigned users read collaborator links"
on public.collaborator_links
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

grant select, insert, update, delete on public.collaborator_links to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS + grants for product permissions
-- ---------------------------------------------------------------------------
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

grant select, insert, update, delete on public.collaborator_partner_products to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Public page-view inserts
-- ---------------------------------------------------------------------------
alter table public.page_views enable row level security;

drop policy if exists "public create page views" on public.page_views;
create policy "public create page views"
on public.page_views
for insert to anon, authenticated
with check (true);

grant insert on public.page_views to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Safe helper to resolve an active referral code
-- ---------------------------------------------------------------------------
create or replace function public.resolve_collaborator_link(link_code text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.collaborator_links
  where code = link_code
    and active = true
  limit 1;
$$;

grant execute on function public.resolve_collaborator_link(text) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification (run separately after the migration if desired)
-- ---------------------------------------------------------------------------
-- select to_regclass('public.collaborator_links');
-- select to_regclass('public.collaborator_partner_products');
-- select public.is_admin();
-- select count(*) from public.products;
