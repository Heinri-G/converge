# 07 — Persistent Storage, History & Sharing

> **Pillar:** Persistent Storage (5) + Sharing · **Order:** 8 · **Depends on:** 02, 06
> **Goal:** the zero-re-research knowledge base — a signed-in user's persistent history with reopen/refine, and sharing of finished reports via public links or explicit user grants, RLS-protected end to end.

References: ARCHITECTURE.md (pillar flow 5, data model + RLS, open decisions), AGENTS.md (Security), Supabase skill (RLS, views, SECURITY DEFINER).

## Decisions locked in

- **History is per-owner** (RLS T1/T2). Guest history remains local until promotion (`02`); on sign-in, `promoteGuestSession` also adopts `candidates/analysis/reports` from `06`.
- **Sharing model:** `shares` supports both `public_link` (unguessable token, anyone with the link) and `user` (grant to a specific user). Token handling:
  - Raw tokens are **never stored** — `shares.token_hash` stores `sha256(token)`, so logs/dumps never leak a working link.
  - Public-link reads go through a **token-gated RPC function**, never through table access (direct anon table access stays RLS-closed).
  - User-granted reads use RLS template **T3** (owner OR grantee).
- **Reopen vs refine:** "Open" shows the saved report; "Refine" starts a **new session** pre-seeded with the prior domain + gate answers (incremental re-research, no re-answering). "Run again" clones the gate state for a fresh pull.
- Mobile-first: the share sheet is a bottom sheet on phones; the share route is a read-only report view.

## Step 1 — `shares` table (migration `0007_shares`)

```sql
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  share_type text not null check (share_type in ('public_link', 'user')),
  token_hash text,                          -- sha256 hex, public_link only
  granted_to uuid references auth.users(id), -- user shares only
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (share_type = 'public_link' and token_hash is not null and granted_to is null)
    or
    (share_type = 'user'        and granted_to is not null and token_hash is null)
  )
);

alter table public.shares enable row level security;

-- owner manages shares (via report -> session ownership)
create policy "owner share select" on public.shares for select
  to authenticated
  using ( exists (
    select 1 from public.reports r
    join public.research_sessions s on s.id = r.session_id
    where r.id = shares.report_id and s.owner_id = (select auth.uid())
  ) );
-- owner insert/update/delete: same join, `with check` on insert/update

-- grantee sees their own grant
create policy "grantee select" on public.shares for select
  to authenticated
  using ( shares.granted_to = (select auth.uid()) and shares.revoked_at is null );
```

Index: `shares(report_id)`, `shares(token_hash)` (unique where `token_hash` is not null).

**T3 read policies on the report family** — add to the existing T2 policies from `06`/`04`:

```sql
create policy "shared read" on public.reports for select
  to authenticated
  using ( exists (
    select 1 from public.shares s
    where s.report_id = reports.id
      and s.share_type = 'user'
      and s.granted_to = (select auth.uid())
      and s.revoked_at is null
  ) );

-- same shape for candidates/analysis, joined via report -> session:
--   join public.reports r on r.session_id = candidates.session_id
--   ... where r.id = s.report_id and s.granted_to = (select auth.uid()) and revoked_at is null
```

## Step 2 — Public-link read RPC (the only anon path to a shared report)

Raw token lookups are not expressible in RLS, so a **token-gated function** is the deliberate bearer model for public links. It lives in schema `api` (no tables there), is `security definer` (this is the documented sanctioned exception — the token check *is* the authorization; a public link has no `auth.uid()`), is revoked from `PUBLIC`, and the `api` schema is added to the PostgREST-exposed schemas in `config.toml` (`[api] schemas = "public, api"`). Run `supabase db advisors` and review per the skill before committing.

```sql
create schema if not exists api;

create or replace function api.get_shared_report(p_token text)
returns jsonb language plpgsql security definer stable as $$
declare
  v_hash  text := encode(sha256(p_token::bytea), 'hex');
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
  from public.candidates c where c.session_id = v_report.session_id;

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
end $$;

revoke all on function api.get_shared_report(text) from public;
grant execute on function api.get_shared_report(text) to anon, authenticated;
```

Defense notes: raw tokens never persisted (hash compare only); `revoked_at` honored; invalid/revoked tokens raise `share_not_found`; base tables remain RLS-closed to anon.

## Step 3 — Sharing logic (`src/features/reports/share.ts`)

```ts
export async function createPublicLink(reportId: string): Promise<string> {
  const token = crypto.randomUUID()                      // unguessable bearer
  const hash = await sha256Hex(token)                    // crypto.subtle.digest
  await db.insertShare({ reportId, shareType: 'public_link', tokenHash: hash })
  return `/r/${token}`
}
export async function grantUser(reportId: string, email: string): Promise<void>  // resolves auth user by email (profiles/auth admin), inserts 'user' share
export async function revokeShare(shareId: string): Promise<void>                // sets revoked_at
```

Client never receives a raw `token_hash` (owner share list shows created/revoked states, not hashes).

## Step 4 — History list + reopen/refine

`src/features/reports/HistoryScreen.tsx` (authed only; guests see an upsell + their local drafts from `offline.ts`):
- Rows: title, domain badge, resolution badge (Complete / Fast Track), updated date. Ordered `updated_at desc`. Tap → report.
- Empty state: "No research saved yet" + start button (44px+).
- **Refine:** creates a new session copying `domain_slug` + a `stage_state` baseline of prior answers → routes into the gate (skips already-answered questions) → new pull. **Run again:** clones gate state for a fresh pull with the same answers.
- Sign-in adoption: `promoteGuestSession` now also copies `candidates/analysis/reports` under the new session (extend `02`'s function).

## Step 5 — Share sheet + shared view (mobile-first)

- `ShareSheet.tsx` — **bottom sheet on phones**, dialog on desktop: "Copy link" (public), "Share with a user" (email → grant), list of active shares with revoke. 44px+ rows, safe-area aware.
- Route `/r/:token` — **read-only** report view: calls `supabase.rpc('get_shared_report', { p_token: token })`, renders the same `ReportScreen` surfaces (matrix/`TopThree`/`AntiPicks`) without save/edit affordances. Invalid token → friendly "This report isn't available" state.

## Verification

1. RLS probes: user B cannot read user A's sessions/reports directly; after a `user` grant B can read report + candidates/analysis; revoke → 0 rows again.
2. Public link: create → open `/r/:token` in an incognito/anon context → full read-only report renders; tampered/revoked token → `share_not_found` error state.
3. `shares.token_hash` is sha256, never the raw token; `rg` the DB dump → no raw token values.
4. History: complete, fast-tracked, and in-progress sessions list correctly; Refine skips answered questions; Run again triggers a fresh pull.
5. Sign in after guest research → reports adopted, no duplicates (idempotent by `session_id` unique).
6. Playwright at 390px (history rows, share sheet as bottom sheet, shared view) and 1440px (dialog, table). No overflow.
7. `supabase db advisors` clean; `npm run lint && npm run typecheck`; impeccable detector once.

## Acceptance checklist

- [ ] `shares` DDL with the share_type invariant check; RLS T3 policies on report family
- [ ] Public links: hashed tokens, RPC-only read path, revoked links die
- [ ] User grants work and revoke cleanly; non-grantees see nothing
- [ ] History persists across sign-out/in; Refine and Run again behave
- [ ] Guest promotion adopts the full session tree without duplicates
- [ ] Verified at 390px and 1440px; read-only shared view renders safely (escaped text)
- [ ] `api` RPC reviewed against the skill's SECURITY DEFINER checklist; advisors clean

## Follow-ups

- Open (ARCHITECTURE.md): exact sharing UX copy, whether public links should expire (`revoked_at` supports it), email-based user resolution UX.
- Everything in `00`–`07` is now in place; a new domain only needs `03`-style seed content, and a new source/LLM/geo provider only touches the `04` adapter boundaries.

## Implementation notes (built)

- **Migration `0007_shares.sql`** (sequential numbering, not the spec's illustrative `0005`): `shares` with the share-type invariant check; owner CRUD via report→session join; grantee select; **T3 read policies** on `reports`/`candidates`/`analysis` (owner OR live user grant); partial-unique `token_hash` index; `revoked_at` honored everywhere.
- **`api` schema + config.toml:** `supabase/config.toml` now exposes `["public", "graphql_public", "api"]`. Two SECURITY DEFINER functions, both `set search_path`, both revoked from PUBLIC:
  - `api.get_shared_report(p_token)` — the only anon path to a report; compares `sha256(token)` to `shares.token_hash`; raises `share_not_found` for invalid/revoked; returns `{ report, candidates, analysis }` as JSONB.
  - `api.resolve_user_id_by_email(p_email)` — resolves `auth.users` by email for the grant UI; authenticated-only.
- **Sharing logic (`src/features/reports/share.ts`):** `createPublicLink` (token = `crypto.randomUUID()`, only `sha256Hex(token)` persisted, returns `/r/<token>`), `grantUser` (resolve email → `user` share), `revokeShare`, `listSharesForReport`. Client never receives a raw `token_hash`.
- **History (`HistoryScreen`):** authed users list `research_sessions` (`updated_at desc`) with domain + resolution badges (Complete / Fast Track / In progress). Per-row actions: **Open report** (finished rows → `/report?session=`), **Continue** (in-progress rows → `/research?session=`), **Refine**, **Run again**. Guests see a local-draft card (from `offline.ts`) plus the sign-in upsell.
- **Reopen/refine/run-again:** `createClonedSession(prior, resolution)` clones `domain_slug` + `stage_state` (prior answers preserved). Refine clones as `in_progress` only for in-progress priors (resumes the gate at the unanswered question) and as `complete` for finished priors (skips re-answering, straight to the pull); Run again clones as `complete`. GateWizard gained a **signed-in resume path** (`?session=` → loads the row, delegates to the shared `resumeSnapshot` used by guests).
- **Guest promotion adoption (`promote.ts`):** now upserts the guest's candidates under the new session, re-links analysis by `source_url`, synthesizes + `saveReport`s, and only clears the guest record when the whole block succeeds (failures keep the guest data for retry; candidate/report upserts stay idempotent via `session_id` uniques).
- **Shared read-only view (`/r/:token`):** calls `get_shared_report` and renders the same `TopThree` / `ComparisonMatrix` / `AntiPicks` surfaces with a "Read only" badge and no save/share/edit affordances. Invalid/revoked tokens land on the "This report isn't available" state.
- **Not verified live (backend not applied here):** RLS cross-account probes, end-to-end public-link open, user-grant grantee reads, and sign-in adoption against the real DB — these need the migration applied (`0007_shares.sql` + `config.toml` `api` schema) and will be probed in the batch verification round.
