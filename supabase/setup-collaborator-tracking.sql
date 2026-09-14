-- 1. Ensure collaborator_links table exists
create table if not exists public.collaborator_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Ensure page_views has tracking columns
alter table public.page_views 
  add column if not exists collaborator_code text,
  add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;

-- 3. Ensure orders has tracking columns
alter table public.orders 
  add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;

-- 4. Enable Row Level Security and add policies for collaborator_links
alter table public.collaborator_links enable row level security;

drop policy if exists "admins manage collaborator links" on public.collaborator_links;
create policy "admins manage collaborator links" on public.collaborator_links 
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "assigned users read collaborator links" on public.collaborator_links;
create policy "assigned users read collaborator links" on public.collaborator_links 
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- 5. Grant access
grant select, insert, update, delete on public.collaborator_links to authenticated;
grant select, insert, update, delete on public.page_views to authenticated;
grant select, insert, update, delete on public.orders to authenticated;

-- 6. Helper function to resolve codes
create or replace function public.resolve_collaborator_link(link_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.collaborator_links where code = link_code and active = true limit 1
$$;
