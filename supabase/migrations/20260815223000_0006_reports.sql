-- 0006_reports — decision-ready deliverable per completed session.
-- Template T2: access is authorized through the owning research session.
-- 07 adds the shared-read (T3) policies on top of these owner policies.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  title text not null default '',
  matrix jsonb not null default '[]'::jsonb,
  top_3 jsonb not null default '[]'::jsonb,
  anti_picks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id)
);

alter table public.reports enable row level security;

create policy "reports owner select" on public.reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = reports.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "reports owner insert" on public.reports for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = reports.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "reports owner update" on public.reports for update
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = reports.session_id
        and rs.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = reports.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "reports owner delete" on public.reports for delete
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = reports.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create index reports_session_idx on public.reports (session_id);

grant select, insert, update, delete on public.reports to anon, authenticated;