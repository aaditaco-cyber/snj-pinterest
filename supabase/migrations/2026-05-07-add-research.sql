-- Adds Research-mode support to the existing sources table.
-- Run once in the Supabase SQL editor on top of an already-applied schema.sql.
-- Idempotent: safe to re-run.

alter table public.sources
  add column if not exists kind text not null default 'discover'
    check (kind in ('discover', 'research'));

alter table public.sources
  add column if not exists pages text[];

-- Existing rows are all discover-kind via the default. Research sources will
-- populate `pages` with one or more URLs; discover sources keep using
-- feed_url and leave pages null.
create index if not exists sources_kind_active_idx
  on public.sources (kind, active);
