# Converge Architecture

Reference for building features. PRODUCT.md is the product source of truth; this file is the technical map. Read the [Supabase skill](.agents/skills/supabase/SKILL.md) before any auth/RLS/schema work and verify Supabase specifics against current docs.

## System overview

- **Client:** Vite + React SPA (strict TypeScript), installable PWA (`vite-plugin-pwa`). State: TanStack Query for cloud rows, React Router, IndexedDB for the guest/offline cache. No backend of our own — everything server-side goes through Supabase.
- **Mobile-first responsive:** the primary experience is a phone (one hand, thumb reach) that expands responsively to desktop. Mobile base styles with `min-width` breakpoints layering complexity up; interactive surfaces (gate questions, fast-track, share sheet) live in thumb reach as bottom sheets on mobile and inline on desktop. Baseline: touch targets ≥44px, inputs ≥16px, safe-area insets, `100dvh`.
- **Backend-as-a-service (Supabase):** Auth, Postgres with row-level security, Edge Functions (Deno) for scraping + sentiment. Supabase is the source of truth for signed-in users.
- **Guest vs signed-in:** Guest sessions are fully client-side (IndexedDB, local UUID). Sign-in is optional; "Save to account" promotes a guest session to cloud rows owned by the user. Nothing a guest does reaches the server until promotion.

### Two rules that shape everything

1. **Edge Functions are stateless executors; the client owns session orchestration.** Functions scrape/analyze and return normalized data; the client persists it via normal RLS-guarded inserts. Functions never write to the DB (no `service_role` in the request path) and never hold UI flow.
2. **Cloud rows are authoritative; offline is best-effort.** The PWA stays usable offline for the in-progress guest/current session, but Supabase is the source of truth and history.

## Pillar flows

### 1. Adaptive Domain Mapping (Stage Gate 1)

Segments a topic into tiers (Capsule → Manual Filter → Entry Espresso → Prosumer) and surfaces 2–3 high-impact branching questions with ℹ️ tooltips.

- **Content, not code:** tiers, branches, questions, and tooltips live in `domain_branches` / `gate_questions` content tables (seeded), not in JSX. New domains ship as seed data with no deploy.
- The client-side flow controller renders a branch's questions from the gate tables; each answer moves the session down one branch level (hard cap below).

### 2. Anti-rabbit-hole controls

- The flow controller **asserts depth ≤ 2 levels** and never renders a third; `stage_state` snapshots keep resume correct.
- **Fast Track / Good Enough** (one click) sets `research_sessions.resolution = 'fast_tracked'` and bypasses remaining branch questions straight to the top broad candidates (the root-tier query). A `resolution = 'complete'` session is one that ran the full gate.

### 3. Localized scraping & red-flag sentiment

- The client invokes the Edge Function `scrape-and-analyze` with `{ query, geo, radiusMinutes }`; drive-time radius filters candidates.
- The function scrapes sources (local listings, Reddit, specialized forums) through per-source adapters with rate limiting and ToS guardrails, normalizes candidates, then LLM-extracts **consensus pros/cons/recurring defects** + a sentiment score per candidate.
- LLM and any geo provider keys live in **Edge Function secrets** — never in the client bundle (`VITE_*` vars are public).
- Scraped text is untrusted: stored and rendered as escaped text, never via `dangerouslySetInnerHTML` (see AGENTS.md security rules).

### 4. Actionable synthesis

- Comparison matrix + **Top 3 Recommended Options** + **Anti-Picks** ("Options to Avoid" with reasons) are generated deterministically from candidates + analysis. Keep this as testable app logic (`src/features/synthesis`), not inside a function.

### 5. Persistent storage, history, sharing

- Reports and state histories persist in Supabase → a zero-re-research personal knowledge base; sessions can be reopened and incrementally updated.
- Sharing: `shares` supports `public_link` (unguessable token, readable by `anon`) and `user` (grant to a specific user). Ship whichever UX the product decides; the schema holds both.

### 6. Authentication

- Supabase Auth (email magic-link + OAuth), `supabase-js`. Verify the current session/cookie model against Supabase docs at implementation time — SPA `localStorage` tokens are the default but AGENTS.md OWASP rules prefer HttpOnly cookies (see Open decisions).

## Client architecture

```
src/
  app/            providers (QueryClient, Supabase), router, PWA registration
  lib/
    supabase.ts   supabase-js client (anon publishable key only)
    types.ts      shared domain types — defined once, imported, never redeclared
    db.ts         typed data layer over supabase-js (RLS-guarded CRUD)
    offline.ts    IndexedDB cache + mutation queue for guest/current session
  features/
    stage-gate/   flow controller, question cards, tooltips, fast-track
    research/     session creation, candidate collection, resume
    synthesis/    comparison matrix, top-3, anti-picks
    reports/      list, view, share, reopen/increment
    auth/         sign-in, guest promotion
  components/     shared presentational UI (no data-fetching orchestration)
```

## Supabase data model + RLS

Schema is changed via imperative migrations (`supabase migration new <name>`); run `supabase db advisors` and the skill's security checklist before committing.

| Table | Purpose | Access model |
|---|---|---|
| `profiles` | public profile per user (`id` = `auth.users.id`) | owner row |
| `research_sessions` | session header: `owner_id`, `domain_slug`, `title`, `resolution` (`complete`/`fast_tracked`), `stage_state` jsonb snapshot | owner |
| `domain_branches` | tier/branch catalog (parent self-ref, depth ≤ 2), seed content | public read |
| `gate_questions` | branching question + prompt + tooltip + options, seed content | public read |
| `candidates` | scraped options: source, url, geo jsonb, rating, normalized data | via session ownership |
| `analysis` | 1:1 per candidate: `sentiment_score`, `pros`/`cons`/`defects` text[], `model` | via session ownership |
| `reports` | matrix jsonb, `top_3` jsonb, `anti_picks` jsonb | owner + shared readers |
| `shares` | `report_id`, `share_type`, unguessable `token`, `granted_to` | owner + grantee + token holder |

RLS rules (non-negotiable, from the Supabase skill):

- **RLS on every table** in exposed schemas; never leave a table open.
- Ownership policies use an ownership predicate, never `TO authenticated` alone (that's BOLA/IDOR):
  `using ((select auth.uid()) = owner_id)` for select; update/delete get `with check ((select auth.uid()) = owner_id)`.
- Session-owned tables (`candidates`, `analysis`, `reports`) authorize **through the session join**, not a denormalized owner copy:
  `using (exists (select 1 from research_sessions rs where rs.id = <table>.session_id and rs.owner_id = (select auth.uid())))`.
- Shared reads union owner + `shares` grants; public-link reads are `to anon` scoped to the token. Any view must be `with (security_invoker = true)`.
- Never use `user_metadata` in authorization; never add `SECURITY DEFINER` to fix a permission error.
- The Data API must grant `anon`/`authenticated` access to new tables explicitly, **and** those grants only matter with RLS on.

## Edge Functions

`supabase/functions/` (Deno):

- `scrape-and-analyze/index.ts` — validates input server-side (authoritative), runs source adapters (rate-limited, ToS-aware), normalizes candidates, LLM sentiment extraction, returns `{ candidates, analysis }`. Client persists. Split a `resolve-drive-time` function out when the geo provider is decided.
- Secrets: LLM key + geo key in function env; never reach the client.

## Agent conventions for feature work

- **New domain/tier/question → seed content rows**, no code change (add to `domain_branches`/`gate_questions`).
- **New feature → `src/features/<name>/`** with `api.ts`/`hooks.ts` separating orchestration from presentational components; presentational components never fetch.
- **Shared types imported from `src/lib/types.ts`**; strict TS, no `any` leakage.
- **Server-side validation is authoritative**; client validation is UX only. Validate every input inside Edge Functions.
- **Verification:** `npm run lint && npm run typecheck` once tooling exists; run the impeccable detector after UI edits; pin `supabase-js` + lockfiles, `npm audit` before release.

## Open decisions (recorded, do not fabricate)

- Geo / drive-time provider (key held server-side).
- LLM provider for sentiment extraction (key held server-side).
- Exact scrape sources and rate-limit/ToS compliance review.
- Sharing UX: public link vs explicit user grants (schema supports both).
- Session storage: SPA localStorage token vs HttpOnly cookie auth — reconcile with AGENTS.md OWASP rules at implementation.
- Realtime progress updates during a scrape run — not confirmed.
