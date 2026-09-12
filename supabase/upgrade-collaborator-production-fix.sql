-- Collaborator production fix
-- Run this ONCE in Supabase SQL Editor for the production project.
-- This aligns database RLS with the server-side admin identity and makes
-- referral-link names independent from the unique referral code.

-- 1) Keep the existing admin-role check, but also recognize the owner account
-- used by the server-side admin gate. This is required because browser-side
-- collaborator creation is protected by Supabase RLS.
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

-- 2) The referral CODE is the unique identifier. Link names should be labels,
-- not uniqueness constraints. Remove the old user+name uniqueness constraint so
-- an admin can create multiple links with the same display name when needed.
alter table public.collaborator_links
drop constraint if exists collaborator_links_user_id_name_key;

-- 3) Re-assert the admin policies used by collaborator creation/management.
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

grant select, insert, update, delete on public.collaborator_links to authenticated;
grant select, insert, delete on public.collaborator_partner_products to authenticated;

-- Verify after running:
-- select public.is_admin();
-- select * from public.collaborator_links order by created_at desc limit 10;
