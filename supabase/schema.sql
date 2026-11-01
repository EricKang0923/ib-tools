-- Database tables and access rules. Run once in the Supabase SQL Editor.
-- Anyone can read the app's public key, so these rules are what protect the data.

-- One row per user: that user's calculator and deadline data.
create table public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calculator jsonb not null default '{}'::jsonb,
  deadlines jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- School dates that every signed-in user gets a copy of.
create table public.shared_deadlines (
  id text primary key,
  title text not null,
  subject text not null,
  due text not null check (due ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$')
);

alter table public.user_data enable row level security;
alter table public.shared_deadlines enable row level security;

-- Logged-out visitors get nothing.
revoke all on public.user_data from anon;
revoke all on public.shared_deadlines from anon;
revoke all on public.user_data from authenticated;
revoke all on public.shared_deadlines from authenticated;

grant select, insert, update on public.user_data to authenticated;
grant select on public.shared_deadlines to authenticated;

-- A user can only read and change their own row.
create policy "read own data" on public.user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "add own data" on public.user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "change own data" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Signed-in users can read school dates. Only the project owner can change them,
-- through the Supabase dashboard, because no rule allows writing from the app.
create policy "read school dates" on public.shared_deadlines
  for select to authenticated
  using (true);
