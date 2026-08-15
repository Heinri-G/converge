-- 0003_research_sessions — the spine of every feature. One row per research
-- run; stage_state snapshots the gate for resume (03/05). Template T1
-- (owner-only, owner column = owner_id). Session rows are created
-- authenticated only — guests stay client-side until promotion (02).

create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  domain_slug text not null,
  title text not null default '',
  resolution text not null default 'in_progress'
    check (resolution in ('in_progress', 'complete', 'fast_tracked')),
  stage_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_sessions enable row level security;

create policy "research_sessions owner select" on public.research_sessions for select
  to authenticated
  using ( (select auth.uid()) = owner_id );

create policy "research_sessions owner insert" on public.research_sessions for insert
  to authenticated
  with check ( (select auth.uid()) = owner_id );

create policy "research_sessions owner update" on public.research_sessions for update
  to authenticated
  using ( (select auth.uid()) = owner_id )
  with check ( (select auth.uid()) = owner_id );

create policy "research_sessions owner delete" on public.research_sessions for delete
  to authenticated
  using ( (select auth.uid()) = owner_id );

create trigger sessions_touch before update on public.research_sessions
  for each row execute function public.touch_updated_at();

create index research_sessions_owner_updated_idx on public.research_sessions (owner_id, updated_at desc);
create index research_sessions_domain_idx on public.research_sessions (domain_slug);

-- Explicit Data API grants; RLS is the row-level gate (anon has no policies).
grant select, insert, update, delete on public.research_sessions to anon, authenticated;
