-- 0001_foundation — shared plumbing for every later migration.
-- pgcrypto provides gen_random_uuid(); touch_updated_at() is reused by
-- every table that carries an updated_at column.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
