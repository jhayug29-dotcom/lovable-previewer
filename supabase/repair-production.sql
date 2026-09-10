-- Production repair for the existing Editly Store database.
-- Run once in Supabase SQL Editor. This is additive/idempotent: it does not drop data,
-- disable RLS, replace the backend, or rebuild existing tables.

-- Core auth/roles used by the application.
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);

grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;

a lter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id);
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catalog tables expected by the current frontend.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
  tagline text default '', description text default '', category text not null default 'After Effects',
  cover_url text, banner_url text, video_url text, price numeric not null default 0,
  original_price numeric not null default 0, is_free boolean not null default false, badge text,
  features text[] not null default '{}', file_info text[] not null default '{}',
  how_to_use jsonb not null default '[]'::jsonb, download_link text, rating numeric not null default 5,
  sales integer not null default 0, active boolean not null default true,
  show_on_homepage boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz default now()
);
alter table public.products add column if not exists show_on_homepage boolean not null default true;

create table if not exists public.product_sections (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  title text not null, content text not null default '', sort_order integer not null default 0,
  enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  name text not null, handle text default '', rating integer not null default 5 check (rating between 1 and 5),
  body text not null, created_at timestamptz default now()
);
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), code text unique not null, percent_off integer not null check (percent_off between 1 and 100),
  active boolean not null default true, expires_at timestamptz, max_uses integer, used_count integer not null default 0,
  created_at timestamptz default now(), product_ids uuid[] not null default '{}'
);
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(), title text not null, subtitle text default '', image_url text,
  link_url text, active boolean not null default true, sort_order integer not null default 0, created_at timestamptz default now()
);
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), title text not null, description text default '', percent_off integer,
  active boolean not null default true, starts_at timestamptz, ends_at timestamptz, created_at timestamptz default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null, cf_order_id text unique, amount numeric not null default 0,
  currency text not null default 'INR', status text not null default 'PENDING', coupon_code text, customer_email text,
  customer_name text, customer_phone text, download_link text, origin text, paid_at timestamptz,
  receipt_sent_at timestamptz, created_at timestamptz default now()
);

-- Columns introduced by the current admin UI.
alter table public.banners add column if not exists emoji text default '';
alter table public.banners add column if not exists cta_label text default '';
alter table public.banners add column if not exists bg_from text default '#7C3AED';
alter table public.banners add column if not exists bg_to text default '#DB2777';
alter table public.banners add column if not exists text_color text default '#FFFFFF';
alter table public.banners add column if not exists starts_at timestamptz;
alter table public.banners add column if not exists ends_at timestamptz;
alter table public.sales add column if not exists sale_type text not null default 'percent';
alter table public.sales add column if not exists flat_price numeric;
alter table public.sales add column if not exists product_ids uuid[] not null default '{}';
alter table public.sales add column if not exists badge_label text default 'SALE';

-- Analytics table responsible for the page_views requests in the console.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(), path text not null default '/', session_id text not null default '',
  user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);

-- Settings used by the Contact tab.
create table if not exists public.site_settings (
  id text primary key default 'global', support_email text not null default '', contact_email text not null default '',
  phone text not null default '', whatsapp text not null default '', address text not null default '',
  support_hours text not null default '', instagram text not null default '', youtube text not null default '',
  twitter text not null default '', refund_policy text not null default '', licence_note text not null default '',
  updated_at timestamptz not null default now()
);

-- Data API grants. Required for Supabase projects using explicit grants.
grant select on public.products, public.reviews, public.banners, public.sales, public.product_sections to anon, authenticated;
grant insert, update, delete on public.products, public.reviews, public.banners, public.sales, public.product_sections to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupons to anon;
grant select on public.orders to authenticated;
grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;
grant insert on public.page_views to anon, authenticated;
grant select on public.page_views to authenticated;

alter table public.products enable row level security;
alter table public.product_sections enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.banners enable row level security;
alter table public.sales enable row level security;
alter table public.orders enable row level security;
alter table public.site_settings enable row level security;
alter table public.page_views enable row level security;

-- Public reads; authenticated admin writes only.
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select to anon, authenticated using (active = true or public.is_admin());
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read product sections" on public.product_sections;
create policy "public read product sections" on public.product_sections for select to anon, authenticated using (enabled = true or public.is_admin());
drop policy if exists "admin write product sections" on public.product_sections;
create policy "admin write product sections" on public.product_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews for select to anon, authenticated using (true);
drop policy if exists "admin write reviews" on public.reviews;
create policy "admin write reviews" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

DO $$ declare t text; begin
  foreach t in array array['banners','sales'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$s', t);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon, authenticated using (active = true or public.is_admin())', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$s', t);
    execute format('create policy "admin write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
END $$;

drop policy if exists "public read coupons" on public.coupons;
create policy "public read coupons" on public.coupons for select to anon, authenticated using (active = true or public.is_admin());
drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admin write site settings" on public.site_settings;
create policy "admin write site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone can record a page view" on public.page_views;
create policy "anyone can record a page view" on public.page_views for insert to anon, authenticated with check (true);
drop policy if exists "admins read page views" on public.page_views;
create policy "admins read page views" on public.page_views for select to authenticated using (public.is_admin());

-- Repair existing/legacy owner accounts without touching passwords or sessions.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role from auth.users u
where lower(u.email) = lower('growchannel2026@gmail.com')
on conflict (user_id, role) do nothing;

insert into public.profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data->>'full_name' from auth.users u
on conflict (id) do nothing;

insert into public.site_settings (id, support_email, contact_email, support_hours)
values ('global', 'growchannel2026@gmail.com', 'growchannel2026@gmail.com', 'Mon–Sat, 10:00–19:00 IST')
on conflict (id) do nothing;

-- Refresh PostgREST after the schema is repaired.
notify pgrst, 'reload schema';
