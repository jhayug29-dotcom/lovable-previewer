-- ============================================================================
-- Editly Store — upgrade: analytics, product-scoped coupons, seller access
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
-- ============================================================================

-- ---------- 1. Seller access ------------------------------------------------
-- A user is a "seller" when they have at least one assigned product below.
-- Sellers can only ever see analytics for the products assigned to them.


-- Products a seller is allowed to see analytics for.
create table if not exists public.seller_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

grant select on public.seller_products to authenticated;
grant all on public.seller_products to service_role;

alter table public.seller_products enable row level security;

drop policy if exists "read own seller products" on public.seller_products;
create policy "read own seller products" on public.seller_products for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage seller products" on public.seller_products;
create policy "admins manage seller products" on public.seller_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. Coupons scoped to specific products --------------------------
alter table public.coupons add column if not exists product_ids uuid[] not null default '{}';

-- ---------- 3. Visitor analytics -------------------------------------------
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null default '/',
  session_id text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);

grant insert on public.page_views to anon, authenticated;
grant select on public.page_views to authenticated;
grant all on public.page_views to service_role;

alter table public.page_views enable row level security;

drop policy if exists "anyone can record a page view" on public.page_views;
create policy "anyone can record a page view" on public.page_views for insert to anon, authenticated
  with check (true);

drop policy if exists "admins read page views" on public.page_views;
create policy "admins read page views" on public.page_views for select to authenticated
  using (public.is_admin());

-- Helpful indexes for the analytics queries.
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_product_id_idx on public.orders (product_id);

-- ---------- 4. Profiles & Admin Roles Synchronization ------------------------
alter table public.profiles add column if not exists last_sign_in_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id or public.is_admin());

-- Update is_admin function to recognize master admin emails directly
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) or exists (
    select 1 from auth.users where id = auth.uid() and lower(email) in ('yjha019@gmail.com', 'growchannel2026@gmail.com')
  )
$$;

-- Seed admin roles for master accounts if users exist
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) in ('yjha019@gmail.com', 'growchannel2026@gmail.com')
on conflict (user_id, role) do nothing;

