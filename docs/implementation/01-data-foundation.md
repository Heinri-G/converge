# 01 — Data foundation

> **Pillar:** enabler (no pillar) · **Order:** 2 · **Depends on:** 00
> **Goal:** Supabase wired to the app, a repeatable migration workflow, the RLS policy templates every later file reuses, and the two cross-cutting tables (`profiles`, `research_sessions`) that the pillar files build on.

References: ARCHITECTURE.md (Supabase data model + RLS, Edge Function conventions), AGENTS.md (`## Security`), the Supabase skill (RLS rules, CLI workflow, Data API grants).

## Decisions locked in

- **Imperative migrations** (`supabase migration new <name>`). Never `apply_migration` to iterate a schema — it writes migration history on every call. Iterate with `execute_sql`/`supabase db query`, then `supabase db pull <name> --local --yes` to commit. Before committing: run `supabase db advisors` and the skill's security checklist.
- Every table in an exposed schema gets **RLS enabled**; the Data API must also grant `anon`/`authenticated` access to new tables explicitly (access + RLS are separate — see skill).
- Session rows are created **authenticated** (guests stay client-side until promotion — see `02`); `owner_id` is NOT NULL on cloud rows.
- Policy style: ownership predicates, never `TO authenticated` alone; `WITH CHECK` on update/insert; session-owned tables authorize **through the session join**; never `user_metadata`; no `SECURITY DEFINER` to fix permission errors; any view gets `security_invoker = true`.

## Step 1 — Supabase project wiring

1. `supabase init` (creates `supabase/config.toml`, `supabase/migrations/`). Link the project: `supabase link --project-ref <ref>`.
2. Local dev: `supabase start`; apply migrations with `supabase db reset` or `supabase migration up`.
3. Reusable workflow, one line each, in the order given:
   - iterate schema → `supabase db query` / MCP `execute_sql`
   - security gate → `supabase db advisors`
   - commit → `supabase db pull <descriptive-name> --local --yes`
   - verify → `supabase migration list --local`

> **Remote-only variant (this repo, no Docker).** There is no local stack on the dev
> machine (no Docker), so schema changes ship as hand-authored migration files created
> with `supabase migration new <name>`, applied by the user in the Dashboard SQL Editor
> (one block per file, in order), and verified with the matching probe in
> `supabase/verification/`. Imperative-migration principles still hold: never `apply_migration`
> to iterate; RLS on every exposed table; explicit `grant ... to anon, authenticated` per table
> (new projects no longer auto-expose tables to the Data API); run the Dashboard Security
> Advisor before considering schema work done.

## Step 2 — Shared plumbing (one migration: `0001_foundation`)

```sql
create extension if not exists pgcrypto; -- gen_random_uuid()

grant usage on schema public to anon, authenticated; -- default in new projects
```

Add a **server-side `updated_at` trigger** now — every table with `updated_at` reuses it:

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
```

## Step 3 — RLS policy templates (the grammar every later file copies)

**T1 — Owner-only row** (profiles, research_sessions):

```sql
alter table <t> enable row level security;

create policy "owner select" on <t> for select
  to authenticated
  using ( (select auth.uid()) = owner_id );

create policy "owner insert" on <t> for insert
  to authenticated
  with check ( (select auth.uid()) = owner_id );

create policy "owner update" on <t> for update
  to authenticated
  using ( (select auth.uid()) = owner_id )
  with check ( (select auth.uid()) = owner_id );

create policy "owner delete" on <t> for delete
  to authenticated
  using ( (select auth.uid()) = owner_id );
```

**T2 — Session-owned row** (candidates, analysis, reports in later files). Authorize through the join, never a denormalized `owner_id` copy:

```sql
create policy "session owner select" on <t> for select
  to authenticated
  using ( exists (
    select 1 from research_sessions rs
    where rs.id = <t>.session_id
      and rs.owner_id = (select auth.uid())
  ) );
```

(insert/update/delete mirror T2 with `with check`; update needs `using` **and** `with check`.)

**T3 — Shared read** (added in `07`): owner OR granted user, per the shares join.

**T4 — Public catalog read** (domain/gate content in `03`): `for select to anon, authenticated using (true)` — RLS on, write policies absent.

> Rules from the skill that bite: an UPDATE needs a matching SELECT policy; without `WITH CHECK` a user can reassign `owner_id`; `auth.role()` is deprecated (use the `TO` clause).

## Step 4 — `profiles`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- policies per template T1 (column: owner_id -> id)
```

Create the profile row on signup (runs inside a `security definer` trigger on `auth.users` — the **only** sanctioned use, with the skill's checklist applied):

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Step 5 — `research_sessions` (the spine of every feature)

```sql
create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  domain_slug text not null,
  title text not null default '',
  resolution text not null default 'in_progress'
    check (resolution in ('in_progress', 'complete', 'fast_tracked')),
  stage_state jsonb not null default '{}'::jsonb, -- gate snapshot for resume (03/05)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.research_sessions enable row level security;
-- policies per template T1 (column: owner_id)

create trigger sessions_touch before update on public.research_sessions
  for each row execute function public.touch_updated_at();
```

Indexes: `(owner_id, updated_at desc)` for the history list (`07`); `(domain_slug)` for catalogs.

Grant table access to the Data API roles (both `anon` and `authenticated` as the project's Data API settings require), with RLS on, per the skill.

## Verification

1. `supabase db advisors` clean; `supabase migration list --local` shows the migration.
2. RLS probe: as user A, insert a session; as user B (`set local role authenticated` + different `auth.uid()` claim), `select` returns 0 rows and `update` returns 0 rows.
3. `handle_new_user` fires: sign up in the auth UI → a `profiles` row exists.
4. `npm run typecheck` still passes in the app.

## Acceptance checklist

- [ ] Supabase linked; local stack boots; migration workflow recorded in this file is followed for all later schema work
- [ ] pgcrypto + touch_updated_at plumbing exist
- [ ] RLS templates T1–T4 documented and T1 proven by the ownership probe
- [ ] `profiles` + trigger work end to end
- [ ] `research_sessions` exists with index, trigger, and T1 policies
- [ ] Data API grants + RLS confirmed on both tables

## Follow-ups

- `02-auth`: guest session model, sign-in, "Save to account" promotion that creates owned `research_sessions` rows.
- Later files add their own tables using these templates: `03` catalog content (T4), `04` candidates/analysis (T2), `06` reports (T2), `07` shares (T3).
