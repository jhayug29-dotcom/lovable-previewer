-- ============================================================================
-- Editly Store — full schema
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- ============================================================================

-- ---------- 1. Roles -------------------------------------------------------
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
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.profiles enable row level security;
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

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Auto-create a profile on signup, and auto-grant admin to the owner email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when lower(new.email) = 'growchannel2026@gmail.com' then 'admin'::public.app_role
                       else 'user'::public.app_role end)
  on conflict (user_id, role) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. Catalog -----------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  tagline text default '',
  description text default '',
  category text not null default 'After Effects',
  cover_url text,
  banner_url text,
  video_url text,
  price numeric not null default 0,
  original_price numeric not null default 0,
  is_free boolean not null default false,
  badge text,
  features text[] not null default '{}',
  file_info text[] not null default '{}',
  how_to_use jsonb not null default '[]'::jsonb,
  download_link text,
  rating numeric not null default 5,
  sales integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  handle text default '',
  rating integer not null default 5 check (rating between 1 and 5),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  percent_off integer not null check (percent_off between 1 and 100),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text default '',
  image_url text,
  link_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  percent_off integer,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  cf_order_id text unique,
  amount numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'PENDING',
  coupon_code text,
  customer_email text,
  customer_name text,
  customer_phone text,
  download_link text,
  origin text,
  paid_at timestamptz,
  receipt_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Safe to re-run on an existing database.
alter table public.orders add column if not exists origin text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists receipt_sent_at timestamptz;

-- Grants
grant select on public.products, public.reviews, public.banners, public.sales to anon;
grant select on public.products, public.reviews, public.banners, public.sales to authenticated;
grant insert, update, delete on public.products, public.reviews, public.banners, public.sales to authenticated;
grant all on public.products, public.reviews, public.banners, public.sales to service_role;

grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupons to anon;
grant all on public.coupons to service_role;

grant select on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.products enable row level security;
alter table public.reviews  enable row level security;
alter table public.coupons  enable row level security;
alter table public.banners  enable row level security;
alter table public.sales    enable row level security;
alter table public.orders   enable row level security;

-- Public read of active content; admin-only writes.
do $$
declare t text;
begin
  foreach t in array array['products','banners','sales'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$s', t);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon, authenticated using (active = true or public.is_admin())', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$s', t);
    execute format('create policy "admin write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews for select to anon, authenticated using (true);
drop policy if exists "admin write reviews" on public.reviews;
create policy "admin write reviews" on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read coupons" on public.coupons;
create policy "public read coupons" on public.coupons for select to anon, authenticated
  using (active = true or public.is_admin());
drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ---------- 3. Storage bucket for product media ---------------------------
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

drop policy if exists "public read product media" on storage.objects;
create policy "public read product media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-media');
drop policy if exists "admin write product media" on storage.objects;
create policy "admin write product media" on storage.objects for all to authenticated
  using (bucket_id = 'product-media' and public.is_admin())
  with check (bucket_id = 'product-media' and public.is_admin());

-- ---------- 4. Site settings (contact / support details) -------------------
create table if not exists public.site_settings (
  id text primary key default 'global',
  support_email text not null default '',
  contact_email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  support_hours text not null default '',
  instagram text not null default '',
  youtube text not null default '',
  twitter text not null default '',
  refund_policy text not null default '',
  licence_note text not null default '',
  updated_at timestamptz not null default now()
);

grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;

alter table public.site_settings enable row level security;

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings" on public.site_settings for select to anon, authenticated
  using (true);
drop policy if exists "admin write site settings" on public.site_settings;
create policy "admin write site settings" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (id, support_email, contact_email, support_hours)
values ('global', 'growchannel2026@gmail.com', 'growchannel2026@gmail.com', 'Mon–Sat, 10:00–19:00 IST')
on conflict (id) do nothing;
