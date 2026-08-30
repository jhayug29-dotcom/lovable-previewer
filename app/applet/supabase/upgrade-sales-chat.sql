-- ============================================================================
-- Editly Store — upgrade: flexible sales, festive banners, support chatbot
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run.
-- ============================================================================

-- ---------- 1. Sales: flat price or percent, all products or a selection ----
alter table public.sales add column if not exists sale_type text not null default 'percent';
alter table public.sales add column if not exists flat_price numeric;
alter table public.sales add column if not exists product_ids uuid[] not null default '{}';
alter table public.sales add column if not exists badge_label text default 'SALE';

do $$ begin
  alter table public.sales add constraint sales_type_check check (sale_type in ('percent','flat'));
exception when duplicate_object then null; end $$;

-- ---------- 2. Banners: festive styling -------------------------------------
alter table public.banners add column if not exists emoji text default '';
alter table public.banners add column if not exists cta_label text default '';
alter table public.banners add column if not exists bg_from text default '#7C3AED';
alter table public.banners add column if not exists bg_to text default '#DB2777';
alter table public.banners add column if not exists text_color text default '#FFFFFF';
alter table public.banners add column if not exists starts_at timestamptz;
alter table public.banners add column if not exists ends_at timestamptz;

-- ---------- 3. Support chatbot messages -------------------------------------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text default '',
  email text default '',
  topic text not null default 'question',
  message text not null,
  reply text default '',
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

grant insert on public.support_messages to anon, authenticated;
grant select, update, delete on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

alter table public.support_messages enable row level security;

drop policy if exists "anyone can write support messages" on public.support_messages;
create policy "anyone can write support messages" on public.support_messages
  for insert to anon, authenticated with check (true);

drop policy if exists "admins read support messages" on public.support_messages;
create policy "admins read support messages" on public.support_messages
  for select to authenticated using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "admins manage support messages" on public.support_messages;
create policy "admins manage support messages" on public.support_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
