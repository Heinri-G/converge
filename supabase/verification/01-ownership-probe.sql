-- 01 verification · RLS ownership probe (run in the Dashboard SQL Editor)
--
-- Run AFTER migrations 0001-0003 have been applied, in this order:
--   A. schema check        -> expect functions=2, tables=2, policies=8
--   B. create probe users  -> proves handle_new_user fires (profiles row auto-created)
--   C. ownership isolation -> B must see 0 rows from A and update 0 rows
--   D. cleanup
--
-- If step B's insert into auth.users is rejected, create two users in
-- Auth -> Users (Add user) instead and substitute their UUIDs below.

-- A -------------------------------------------------------------------------
select
  (select count(*) from pg_proc where proname in ('touch_updated_at', 'handle_new_user')) as functions,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name in ('profiles', 'research_sessions')) as tables,
  (select count(*) from pg_policies where schemaname = 'public') as policies;

-- B -------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'probe.a@example.test', crypt('probe', gen_salt('bf')),
   now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'probe.b@example.test', crypt('probe', gen_salt('bf')),
   now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select id as probe_user, email
from auth.users
where email like 'probe.%@example.test';

-- handle_new_user must have created profiles rows (expect 2):
select id
from public.profiles
where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

-- C -------------------------------------------------------------------------
-- User A inserts a session (works: owner == auth.uid()):
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into public.research_sessions (owner_id, domain_slug, title)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'coffee', 'A only')
returning id;
commit;

-- User B: SELECT must return 0 rows, UPDATE must affect 0 rows:
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select count(*) as b_sees_rows from public.research_sessions;
update public.research_sessions set title = 'compromised' returning id;
commit;

-- D -------------------------------------------------------------------------
delete from public.research_sessions
where owner_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
delete from public.profiles
where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
delete from auth.users where email like 'probe.%@example.test';
