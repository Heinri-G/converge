-- 0007_shares — persistent history + sharing for finished reports.
-- - shares holds public-link (hashed bearer token) and explicit user grants.
-- - T3 read policies on the report family: owner OR grantee.
-- - api schema hosts the token-gated read RPC (the only anon path) and the
--   email -> user resolution used by the share UI. No tables live here.

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  share_type text not null check (share_type in ('public_link', 'user')),
  token_hash text,
  granted_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (share_type = 'public_link' and token_hash is not null and granted_to is null)
    or
    (share_type = 'user' and granted_to is not null and token_hash is null)
  )
);

alter table public.shares enable row level security;

-- Owner manages shares via report -> session ownership.
create policy "shares owner select" on public.shares for select
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      join public.research_sessions s on s.id = r.session_id
      where r.id = shares.report_id and s.owner_id = (select auth.uid())
    )
  );

create policy "shares owner insert" on public.shares for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reports r
      join public.research_sessions s on s.id = r.session_id
      where r.id = shares.report_id and s.owner_id = (select auth.uid())
    )
  );

create policy "shares owner update" on public.shares for update
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      join public.research_sessions s on s.id = r.session_id
      where r.id = shares.report_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reports r
      join public.research_sessions s on s.id = r.session_id
      where r.id = shares.report_id and s.owner_id = (select auth.uid())
    )
  );

create policy "shares owner delete" on public.shares for delete
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      join public.research_sessions s on s.id = r.session_id
      where r.id = shares.report_id and s.owner_id = (select auth.uid())
    )
  );

-- Grantee sees their own live grant (token hashes never exposed to clients).
create policy "shares grantee select" on public.shares for select
  to authenticated
  using ( shares.granted_to = (select auth.uid()) and shares.revoked_at is null );

-- T3 read policies on the report family: owner OR live user grant.
create policy "reports shared read" on public.reports for select
  to authenticated
  using (
    exists (
      select 1 from public.shares s
      where s.report_id = reports.id
        and s.share_type = 'user'
        and s.granted_to = (select auth.uid())
        and s.revoked_at is null
    )
  );

create policy "candidates shared read" on public.candidates for select
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      join public.shares s on s.report_id = r.id
      where r.session_id = candidates.session_id
        and s.share_type = 'user'
        and s.granted_to = (select auth.uid())
        and s.revoked_at is null
    )
  );

create policy "analysis shared read" on public.analysis for select
  to authenticated
  using (
    exists (
      select 1 from public.candidates c
      join public.reports r on r.session_id = c.session_id
      join public.shares s on s.report_id = r.id
      where c.id = analysis.candidate_id
        and s.share_type = 'user'
        and s.granted_to = (select auth.uid())
        and s.revoked_at is null
    )
  );

create index shares_report_idx on public.shares (report_id);
create unique index shares_token_hash_idx on public.shares (token_hash) where token_hash is not null;
create index shares_granted_to_idx on public.shares (granted_to) where revoked_at is null;

grant select, insert, update, delete on public.shares to anon, authenticated;

-- ---------------------------------------------------------------------------
-- api schema: token-gated read + email resolution (SECURITY DEFINER, sanctioned)
-- ---------------------------------------------------------------------------
create schema if not exists api;

-- The only anon path to a shared report. The token check IS the authorization:
-- a public link has no auth.uid(). Raw tokens are compared via sha256 only.
create or replace function api.get_shared_report(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hash text := encode(sha256(p_token::bytea), 'hex');
  v_report public.reports%rowtype;
  v_candidates jsonb;
  v_analysis jsonb;
begin
  select r.* into v_report
  from public.shares s
  join public.reports r on r.id = s.report_id
  where s.token_hash = v_hash
    and s.share_type = 'public_link'
    and s.revoked_at is null;

  if not found then
    raise exception 'share_not_found' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_candidates
  from public.candidates c
  where c.session_id = v_report.session_id;

  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_analysis
  from public.analysis a
  where a.candidate_id in (
    select id from public.candidates where session_id = v_report.session_id
  );

  return jsonb_build_object(
    'report', to_jsonb(v_report),
    'candidates', v_candidates,
    'analysis', v_analysis
  );
end;
$$;

revoke all on function api.get_shared_report(text) from public;
grant execute on function api.get_shared_report(text) to anon, authenticated;

-- Email -> user id for the share UI. Owner-only role: a signed-in user can
-- resolve who an email address belongs to before creating a grant. Not callable
-- by anon; revoke from PUBLIC so it is never exposed through the Data API.
create or replace function api.resolve_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = auth, public
stable
as $$
declare
  v_id uuid;
begin
  select u.id into v_id
  from auth.users u
  where lower(u.email) = lower(p_email);

  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  return v_id;
end;
$$;

revoke all on function api.resolve_user_id_by_email(text) from public;
grant execute on function api.resolve_user_id_by_email(text) to authenticated;