-- Editly Store collaborator deep-audit migration.
-- Safe to run repeatedly in the production Supabase project.
-- It repairs schema/RLS, makes product access idempotent for legacy clients,
-- and adds product-scoped page-view attribution.

-- ---------------------------------------------------------------------------
-- 1) Core collaborator tables
-- ---------------------------------------------------------------------------
create table if not exists public.collaborator_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.collaborator_links add column if not exists code text;
alter table public.collaborator_links add column if not exists name text;
alter table public.collaborator_links add column if not exists user_id uuid;
alter table public.collaborator_links add column if not exists email text;
alter table public.collaborator_links add column if not exists active boolean not null default true;
alter table public.collaborator_links add column if not exists created_at timestamptz not null default now();

create unique index if not exists collaborator_links_code_uidx on public.collaborator_links(code);
create index if not exists collaborator_links_user_idx on public.collaborator_links(user_id);
create index if not exists collaborator_links_created_idx on public.collaborator_links(created_at desc);

create table if not exists public.collaborator_partner_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create unique index if not exists collaborator_partner_products_uidx
  on public.collaborator_partner_products(user_id, product_id);
create index if not exists collaborator_partner_products_user_idx
  on public.collaborator_partner_products(user_id);
create index if not exists collaborator_partner_products_product_idx
  on public.collaborator_partner_products(product_id);

-- ---------------------------------------------------------------------------
-- 2) Product-scoped page-view attribution
-- ---------------------------------------------------------------------------
alter table public.page_views
  add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;
alter table public.page_views add column if not exists collaborator_code text;
alter table public.page_views add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.page_views add column if not exists session_id text;

create index if not exists page_views_collaborator_link_idx on public.page_views(collaborator_link_id);
create index if not exists page_views_collaborator_code_idx on public.page_views(collaborator_code);
create index if not exists page_views_collaborator_product_idx on public.page_views(collaborator_code, product_id);
create index if not exists page_views_product_idx on public.page_views(product_id);

alter table public.orders add column if not exists collaborator_link_id uuid references public.collaborator_links(id) on delete set null;
create index if not exists orders_collaborator_link_idx on public.orders(collaborator_link_id);

-- ---------------------------------------------------------------------------
-- 3) Admin identity/RLS consistency
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

alter table public.collaborator_links enable row level security;
alter table public.collaborator_partner_products enable row level security;
alter table public.page_views enable row level security;

drop policy if exists "admins manage collaborator links" on public.collaborator_links;
create policy "admins manage collaborator links"
on public.collaborator_links for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "assigned users read collaborator links" on public.collaborator_links;
create policy "assigned users read collaborator links"
on public.collaborator_links for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage collaborator partner products" on public.collaborator_partner_products;
create policy "admins manage collaborator partner products"
on public.collaborator_partner_products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "collaborators read own product access" on public.collaborator_partner_products;
create policy "collaborators read own product access"
on public.collaborator_partner_products for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "public create page views" on public.page_views;
create policy "public create page views"
on public.page_views for insert to anon, authenticated
with check (
  collaborator_code is null
  or exists (
    select 1
    from public.collaborator_links cl
    where cl.id = collaborator_link_id
      and cl.code = collaborator_code
      and cl.active = true
  )
);

drop policy if exists "admins read page views" on public.page_views;
create policy "admins read page views"
on public.page_views for select to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.collaborator_links to authenticated;
grant select, insert, update, delete on public.collaborator_partner_products to authenticated;
grant insert on public.page_views to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Legacy-client idempotency
-- ---------------------------------------------------------------------------
-- Older collaborator UI builds used plain INSERT for product access. This trigger
-- makes those stale clients harmless when access already exists for the same
-- collaborator/product pair. New builds use server-side UPSERT as well.
create or replace function public.ignore_duplicate_collaborator_product_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.collaborator_partner_products
    where user_id = new.user_id and product_id = new.product_id
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists collaborator_partner_products_dedupe on public.collaborator_partner_products;
create trigger collaborator_partner_products_dedupe
before insert on public.collaborator_partner_products
for each row execute function public.ignore_duplicate_collaborator_product_access();

-- ---------------------------------------------------------------------------
-- 5) Collaborator-link resolver used by referral tracking
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
  where code = link_code and active = true
  limit 1;
$$;

grant execute on function public.resolve_collaborator_link(text) to anon, authenticated;
