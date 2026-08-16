-- 0009_fix_share_rls_recursion — break the RLS infinite recursion between
-- `reports` and `shares` (Postgres error 42P17).
--
-- The `reports shared read` policy (0007) subqueried `shares`, while the
-- `shares owner *` policies subquery `reports` + `research_sessions`, so
-- evaluating either one re-entered the other forever. Every read touching the
-- report family (history list, report page, guest promotion) died with
-- "infinite recursion detected in policy for relation reports".
--
-- Fix: route the grantee check through a SECURITY DEFINER helper in the `api`
-- schema (the same sanctioned pattern as `api.get_shared_report`). The helper
-- runs with definer privileges, so the policy never re-applies RLS on `shares`
-- and the cycle is broken. The helper still checks `granted_to = auth.uid()`
-- and live (`revoked_at is null`) grants — authorization is unchanged, only
-- the recursion mechanism is removed.

create or replace function api.user_can_read_report(p_report_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.shares s
    where s.report_id = p_report_id
      and s.share_type = 'user'
      and s.granted_to = (select auth.uid())
      and s.revoked_at is null
  );
$$;

revoke all on function api.user_can_read_report(uuid) from public;
grant execute on function api.user_can_read_report(uuid) to authenticated;

drop policy "reports shared read" on public.reports;
create policy "reports shared read" on public.reports for select
  to authenticated
  using ( api.user_can_read_report(reports.id) );
