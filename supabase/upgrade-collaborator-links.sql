-- Collaborator link attribution and reporting
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

alter table public.page_views add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;
alter table public.page_views add column if not exists collaborator_code text;
alter table public.orders add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;
create index if not exists page_views_collaborator_link_idx on public.page_views(collaborator_link_id);
create index if not exists orders_collaborator_link_idx on public.orders(collaborator_link_id);

grant select, insert, update, delete on public.collaborator_links to authenticated;
grant insert on public.page_views to anon, authenticated;
grant update on public.orders to authenticated;
alter table public.collaborator_links enable row level security;
drop policy if exists "admins manage collaborator links" on public.collaborator_links;
create policy "admins manage collaborator links" on public.collaborator_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "assigned users read collaborator links" on public.collaborator_links;
create policy "assigned users read collaborator links" on public.collaborator_links for select to authenticated using (auth.uid() = user_id or public.is_admin());

alter table public.page_views enable row level security;
drop policy if exists "public create page views" on public.page_views;
create policy "public create page views" on public.page_views for insert to anon, authenticated with check (true);
create or replace function public.resolve_collaborator_link(link_code text)
returns uuid language sql stable security invoker set search_path = public as $$
  select id from public.collaborator_links where code = link_code and active = true limit 1
$$;

create or replace function public.collaborator_link_stats(link_id uuid)
returns table(visitors bigint, page_views bigint, sales bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select
    count(distinct pv.session_id), count(pv.id),
    count(distinct o.id) filter (where upper(o.status) in ('PAID','SUCCESS','COMPLETED','CAPTURED','FREE')),
    coalesce(sum(o.amount) filter (where upper(o.status) in ('PAID','SUCCESS','COMPLETED','CAPTURED','FREE')), 0)
  from public.page_views pv
  full join public.orders o on o.collaborator_link_id = link_id
  where pv.collaborator_link_id = link_id or o.collaborator_link_id = link_id
$$;
revoke all on function public.collaborator_link_stats(uuid) from public;
grant execute on function public.collaborator_link_stats(uuid) to authenticated;

alter table public.page_views add column if not exists session_id text;
-- Run this migration through the Supabase SQL tool before using the dashboard.

