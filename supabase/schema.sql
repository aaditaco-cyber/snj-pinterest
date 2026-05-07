-- SNJ Pinterest schema
-- Run this in Supabase SQL Editor (Database > SQL Editor > New query > paste > Run).
--
-- Shared-team mode:
--   sources  — shared (any authenticated user can add; only the original adder
--              can edit/delete). Tracks added_by for attribution.
--   products — shared (one row per product_url, scraped once for everyone).
--   user_product_states — per-user skip/save/archive on shared products.
--                         Absence of a row = "new" for that user.
--   folders / folder_items / swipe_actions — per-user (each person's saves
--              and skips are personal).
--
-- This script is destructive: it drops the existing tables before recreating
-- them, so all current sources and products are wiped. Folder defaults are
-- re-seeded for existing users by the trigger only on signup, so existing
-- users will lose their folders too — re-run the seed manually if needed.

-- ─── Drop existing ─────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.swipe_actions cascade;
drop table if exists public.folder_items cascade;
drop table if exists public.user_product_states cascade;
drop table if exists public.folders cascade;
drop table if exists public.products cascade;
drop table if exists public.sources cascade;

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  added_by uuid references auth.users(id) on delete set null,
  name text not null,
  url text not null unique,
  feed_url text,
  platform text check (platform in ('shopify', 'custom', 'unknown')),
  freshness_window_days integer not null default 30 check (freshness_window_days between 1 and 365),
  category text,
  notes text,
  active boolean not null default true,
  date_added timestamptz not null default now(),
  last_ingest_at timestamptz,
  last_ingest_count integer
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  title text not null,
  image_url text,
  additional_images text[] not null default '{}',
  product_url text not null unique,
  retailer text,
  price numeric,
  price_display text,
  category text,
  metal_type text,
  carat_weight text,
  stone_type text,
  source_url text,
  date_discovered timestamptz not null default now()
);

create table public.user_product_states (
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  status text not null check (status in ('skipped', 'saved', 'archived')),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null,
  icon text,
  "order" integer not null default 0,
  archived boolean not null default false,
  date_created timestamptz not null default now()
);

create table public.folder_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references public.folders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  notes text,
  tags text[] not null default '{}',
  date_added timestamptz not null default now(),
  unique (folder_id, product_id)
);

create table public.swipe_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  action text not null check (action in ('skip', 'save')),
  folder_ids uuid[] not null default '{}',
  timestamp timestamptz not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index products_date_idx on public.products (date_discovered desc);
create index products_category_idx on public.products (category);
create index products_source_idx on public.products (source_id);
create index user_product_states_user_status_idx on public.user_product_states (user_id, status);
create index folder_items_folder_idx on public.folder_items (folder_id);
create index folder_items_product_idx on public.folder_items (product_id);
create index folder_items_user_idx on public.folder_items (user_id);
create index sources_active_idx on public.sources (active);
create index swipe_actions_user_time_idx on public.swipe_actions (user_id, timestamp desc);

-- ─── Row-Level Security ─────────────────────────────────────────────────────

alter table public.sources enable row level security;
alter table public.products enable row level security;
alter table public.user_product_states enable row level security;
alter table public.folders enable row level security;
alter table public.folder_items enable row level security;
alter table public.swipe_actions enable row level security;

-- Sources: any authenticated user can read or add; only the creator can
-- modify or remove. added_by is set to auth.uid() at insert time and cannot
-- be changed afterward (with check enforces it on update too).
create policy "sources read" on public.sources
  for select to authenticated using (true);
create policy "sources insert" on public.sources
  for insert to authenticated with check (added_by = auth.uid());
create policy "sources update" on public.sources
  for update to authenticated
  using (added_by = auth.uid())
  with check (added_by = auth.uid());
create policy "sources delete" on public.sources
  for delete to authenticated using (added_by = auth.uid());

-- Products: shared. Any authenticated user can read, ingest, or remove a row.
create policy "products read" on public.products
  for select to authenticated using (true);
create policy "products insert" on public.products
  for insert to authenticated with check (true);
create policy "products update" on public.products
  for update to authenticated using (true) with check (true);
create policy "products delete" on public.products
  for delete to authenticated using (true);

-- Per-user tables — own rows only.
create policy "own user_product_states" on public.user_product_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own folder_items" on public.folder_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own swipe_actions" on public.swipe_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Seed default folders for new users ─────────────────────────────────────
-- When a new user signs up, give them the default 10 buckets so the app feels
-- populated immediately. Sources are shared, so no per-user source seed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.folders (user_id, name, color, "order") values
    (new.id, 'Trends',              '#b08d57', 0),
    (new.id, 'Design Inspiration',  '#ec4899', 1),
    (new.id, 'Gemstone Ideas',      '#0d9488', 2),
    (new.id, 'Bridal Ideas',        '#d97706', 3),
    (new.id, 'Macy''s',             '#ef4444', 4),
    (new.id, 'Bloomingdale''s',     '#525252', 5),
    (new.id, 'Blue Nile',           '#0ea5e9', 6),
    (new.id, 'Rare Carat',          '#10b981', 7),
    (new.id, 'The RealReal',        '#7c3aed', 8),
    (new.id, 'Costco',              '#f59e0b', 9);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
