-- ============================================================================
-- Supabase Security Hardening — Protect Paid Product Download Links & RLS
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- 0. Ensure role helpers exist safely
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.has_role(auth.uid(), 'admin'), false)
$$;

-- 1. Revoke public column-level access to download_link on the products table.
-- We dynamically discover all existing columns on public.products and grant SELECT
-- on all columns EXCEPT download_link to anon and authenticated.
-- This avoids hardcoding column names and prevents "column does not exist" errors.
do $$
declare
  col text;
begin
  -- Revoke table-wide SELECT from public/anon/authenticated roles
  revoke select on public.products from anon;
  revoke select on public.products from authenticated;

  -- Grant SELECT column-by-column on every column EXCEPT download_link
  for col in 
    select column_name 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'products' 
      and column_name != 'download_link'
  loop
    execute format('grant select (%I) on public.products to anon, authenticated;', col);
  end loop;
end $$;

-- 2. Ensure service_role maintains full access for server-side order settlement and receipt delivery.
grant all on public.products to service_role;

-- 3. Secure RLS policies on orders table:
-- Ensure only authenticated owners can read their own paid orders, and admins can manage all orders.
alter table public.orders enable row level security;

drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 4. Secure user_roles table:
-- Prevent any user from modifying their own roles or granting themselves admin privileges.
alter table public.user_roles enable row level security;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 5. Secure coupons table:
-- Public can read active coupons, only admins can create or modify coupons.
alter table public.coupons enable row level security;

drop policy if exists "public read coupons" on public.coupons;
create policy "public read coupons" on public.coupons for select to anon, authenticated
  using (active = true or public.is_admin());

drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
