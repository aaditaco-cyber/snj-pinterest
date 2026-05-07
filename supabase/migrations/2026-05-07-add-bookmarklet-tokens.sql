-- Per-user secret token used to authenticate bookmarklet POSTs from
-- third-party origins (where session cookies don't work). One token per user;
-- regenerating just overwrites the row.

create table if not exists public.user_bookmarklet_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.user_bookmarklet_tokens enable row level security;

drop policy if exists "own bookmarklet tokens" on public.user_bookmarklet_tokens;
create policy "own bookmarklet tokens" on public.user_bookmarklet_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
