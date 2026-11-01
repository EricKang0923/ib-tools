-- Adds Chemistry questions and revision notes. Run once in the SQL Editor,
-- after add-questions.sql and add-worksheets.sql.

alter table public.questions
  add column subject text not null default 'Physics',
  add column paper_type text,
  add column levels text[] not null default '{}',
  add column has_answer_image boolean not null default false,
  add column has_report boolean not null default false;

create table public.notes (
  id text primary key,
  subject text not null,
  group_name text not null,
  title text not null
);

alter table public.notes enable row level security;

revoke all on public.notes from anon;
revoke all on public.notes from authenticated;
grant select, insert on public.notes to authenticated;

create policy "read notes" on public.notes
  for select to authenticated
  using (true);

create policy "admin adds notes" on public.notes
  for insert to authenticated
  with check (exists (select 1 from public.admins where user_id = (select auth.uid())));
