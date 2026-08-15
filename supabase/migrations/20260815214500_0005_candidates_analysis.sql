-- 0005_candidates_analysis — normalized scrape output and per-candidate sentiment.
-- Template T2: access is authorized through the owning research session.

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  source text not null,
  source_url text not null,
  name text not null,
  geo jsonb not null default '{}'::jsonb,
  rating numeric check (rating is null or rating between 0 and 5),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, source_url)
);

create table public.analysis (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  sentiment_score numeric not null check (sentiment_score between -1 and 1),
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  defects text[] not null default '{}',
  source_summary text not null default '',
  model text not null default '',
  created_at timestamptz not null default now()
);

alter table public.candidates enable row level security;
alter table public.analysis enable row level security;

create policy "candidates owner select" on public.candidates for select
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = candidates.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "candidates owner insert" on public.candidates for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = candidates.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "candidates owner update" on public.candidates for update
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = candidates.session_id
        and rs.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = candidates.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "candidates owner delete" on public.candidates for delete
  to authenticated
  using (
    exists (
      select 1
      from public.research_sessions rs
      where rs.id = candidates.session_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "analysis owner select" on public.analysis for select
  to authenticated
  using (
    exists (
      select 1
      from public.candidates c
      join public.research_sessions rs on rs.id = c.session_id
      where c.id = analysis.candidate_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "analysis owner insert" on public.analysis for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.candidates c
      join public.research_sessions rs on rs.id = c.session_id
      where c.id = analysis.candidate_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "analysis owner update" on public.analysis for update
  to authenticated
  using (
    exists (
      select 1
      from public.candidates c
      join public.research_sessions rs on rs.id = c.session_id
      where c.id = analysis.candidate_id
        and rs.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.candidates c
      join public.research_sessions rs on rs.id = c.session_id
      where c.id = analysis.candidate_id
        and rs.owner_id = (select auth.uid())
    )
  );

create policy "analysis owner delete" on public.analysis for delete
  to authenticated
  using (
    exists (
      select 1
      from public.candidates c
      join public.research_sessions rs on rs.id = c.session_id
      where c.id = analysis.candidate_id
        and rs.owner_id = (select auth.uid())
    )
  );

create index candidates_session_idx on public.candidates (session_id);

grant select, insert, update, delete on public.candidates to anon, authenticated;
grant select, insert, update, delete on public.analysis to anon, authenticated;
