-- 0002_profiles — the authenticated user's public identity row.
-- Template T1 (owner-only, owner column = id). One row per auth.users entry,
-- created by the handle_new_user() trigger on signup.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles owner select" on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

create policy "profiles owner insert" on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = id );

create policy "profiles owner update" on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

create policy "profiles owner delete" on public.profiles for delete
  to authenticated
  using ( (select auth.uid()) = id );

-- Signup hook. Sanctioned SECURITY DEFINER use: the trigger must insert the
-- profile row for a user who does not yet exist in public.profiles (RLS would
-- block the insert otherwise). Fixed search_path; execute revoked from
-- PUBLIC so it cannot be invoked directly through the Data API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- New projects do not auto-expose tables to the Data API; grant explicitly.
-- RLS remains the row-level gate (anon has no policies, so anon sees nothing).
grant select, insert, update, delete on public.profiles to anon, authenticated;
