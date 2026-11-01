-- Private question bank: only signed-in users can read, only the admin can add.
-- Run once in the SQL Editor, after add-admin.sql.

alter table public.user_data add column practice jsonb not null default '{}'::jsonb;

create table public.questions (
  id text primary key,
  unit text not null,
  topic text not null default '',
  paper text not null,
  year integer not null,
  answer text not null
);

alter table public.questions enable row level security;

revoke all on public.questions from anon;
revoke all on public.questions from authenticated;
grant select, insert on public.questions to authenticated;

create policy "read questions" on public.questions
  for select to authenticated
  using (true);

create policy "admin adds questions" on public.questions
  for insert to authenticated
  with check (exists (select 1 from public.admins where user_id = (select auth.uid())));

-- A private bucket: images have no public link.
insert into storage.buckets (id, name, public)
values ('questions', 'questions', false);

create policy "signed-in users read question images" on storage.objects
  for select to authenticated
  using (bucket_id = 'questions');

create policy "admin uploads question images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'questions'
    and exists (select 1 from public.admins where user_id = (select auth.uid()))
  );
