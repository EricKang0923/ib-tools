-- Private worksheet storage: only signed-in users can read, only the admin can add.
-- Run once in the SQL Editor, after add-admin.sql.

create table public.worksheets (
  code text primary key,
  title text not null,
  question_file text,
  solution_file text
);

alter table public.worksheets enable row level security;

revoke all on public.worksheets from anon;
revoke all on public.worksheets from authenticated;
grant select, insert, update on public.worksheets to authenticated;

create policy "read worksheets" on public.worksheets
  for select to authenticated
  using (true);

create policy "admin adds worksheets" on public.worksheets
  for insert to authenticated
  with check (exists (select 1 from public.admins where user_id = (select auth.uid())));

create policy "admin changes worksheets" on public.worksheets
  for update to authenticated
  using (exists (select 1 from public.admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public)
values ('worksheets', 'worksheets', false);

create policy "signed-in users read worksheet files" on storage.objects
  for select to authenticated
  using (bucket_id = 'worksheets');

create policy "admin uploads worksheet files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'worksheets'
    and exists (select 1 from public.admins where user_id = (select auth.uid()))
  );
