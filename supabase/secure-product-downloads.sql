-- ============================================================================
-- Supabase Security Hardening — Protect Paid Product Download Links
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- 1. Revoke public column-level access to download_link on the products table.
-- This ensures that anonymous visitors and regular authenticated users cannot
-- inspect developer tools to extract Google Drive download links of paid products.

revoke select on public.products from anon;
revoke select on public.products from authenticated;

-- 2. Explicitly grant SELECT on all public storefront columns to anon and authenticated.
-- (Notice: download_link is intentionally omitted from public select privileges).
grant select (
  id,
  slug,
  title,
  tagline,
  description,
  category,
  cover_url,
  banner_url,
  video_url,
  price,
  original_price,
  is_free,
  badge,
  features,
  file_info,
  how_to_use,
  rating,
  sales,
  active,
  show_on_homepage,
  sort_order,
  launch_time,
  timer_image_url,
  created_at
) on public.products to anon, authenticated;

-- 3. Ensure service_role maintains full access for server-side order settlement and receipt delivery.
grant all on public.products to service_role;

-- 4. Secure RLS policies on orders table:
-- Ensure only authenticated owners can read their own paid orders, and admins can manage all orders.
alter table public.orders enable row level security;

drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 5. Secure user_roles table:
-- Prevent any user from modifying their own roles or granting themselves admin privileges.
alter table public.user_roles enable row level security;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 6. Secure coupons table:
-- Public can read active coupons, only admins can create or modify coupons.
alter table public.coupons enable row level security;

drop policy if exists "public read coupons" on public.coupons;
create policy "public read coupons" on public.coupons for select to anon, authenticated
  using (active = true or public.is_admin());

drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
