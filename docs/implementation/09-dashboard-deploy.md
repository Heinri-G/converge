# 09 — Dashboard Deploy + End-to-End Test Guide

> **Status:** the provider adapters are implemented and committed with `38f94ad`'s follow-up
> (see `08-follow-up.md` Step 3). What remains is deploy + E2E test work — this file is the
> exact walkthrough, plus the E2E test checklist. The Dashboard covers schemas/secrets; the
> function itself must be deployed with the Supabase CLI (the Dashboard's function editor is
> single-file with no version control). Install the CLI with `npm i supabase`.

Prereq: migrations `0001`–`0008` are applied (the first seven were applied by hand before
this file; `0008` grants `USAGE` on the `api` schema — see Part A).

## Part A — Expose the `api` schema (Step 1 of `08`)

The repo's `supabase/config.toml` already lists `["public", "graphql_public", "api"]`
(committed in `38f94ad`), but the cloud project's PostgREST config is separate.

> **Where this setting lives (current Dashboard):** the old **Settings → API → Exposed
> schemas** path was moved. It is now under **Integrations → Data API → Settings** —
> direct URL `https://supabase.com/dashboard/project/<ref>/integrations/data_api/settings`.
> (Legacy links to `.../settings/api` redirect there.) Per the current official docs
> ("Build an API route in less than 2 minutes" → "Enable Data API access to Anon Role"):
> "In the **Integrations > Data API > Settings** section of the Dashboard. Under **Exposed
> schemas**, make sure `public` is included" — add `api` the same way.

1. Open your Supabase project → **Integrations** (left sidebar) → **Data API** → **Settings**.
2. Under **Exposed schemas**, click **Edit** and add `api`. Save.
3. Also confirm the `api` schema has `USAGE` granted to the Data API roles. Migration
   `0008_api_schema_grants.sql` adds it, but if you applied `0007` before that migration
   exists, run this in the SQL Editor:

   ```sql
   grant usage on schema api to anon, authenticated;
   ```
4. Verify in the **SQL Editor** — as the `anon` role this must no longer 404:

   ```sql
   select api.get_shared_report('definitely-fake-token');
   -- expect: "share_not_found" error row, NOT function-not-found / permission denied
   select api.resolve_user_id_by_email('nobody@example.com');
   -- anon is NOT granted this one (authenticated only) — fine if it errors on anon
   ```

## Part B — Deploy `scrape-and-analyze` + secrets (Step 2 of `08`)

The function is a **5-file module** (`pipeline.ts`, `geo.ts`, `sources.ts`, `sentiment.ts`,
`index.ts`). The Dashboard's Edge Function editor only edits a **single entry file and has
no version control** (per the official "Edge Functions (Dashboard)" quickstart), so it is
not a fit for this function. Deploy with the Supabase CLI instead:

1. **Install the CLI** if it isn't on this machine:

   ```bash
   npm i supabase
   ```
2. **Log in and link** to your project:

   ```bash
   npx supabase login                     # opens a browser, creates a personal access token
   npx supabase link --project-ref <ref>  # ref = the project id in your project URL
   ```
3. **Deploy** — the repo's `supabase/functions/scrape-and-analyze/` is already a valid
   function directory, so from the repo root:

   ```bash
   npx supabase functions deploy scrape-and-analyze
   ```
4. **Secrets** — either CLI or Dashboard:

   ```bash
   npx supabase secrets set LLM_API_KEY=... LLM_MODEL=... TAVILY_API_KEY=...
   # optional override:
   npx supabase secrets set LLM_BASE_URL=https://api.openai.com/v1
   ```

   Dashboard alternative: **Edge Functions → Secrets Management** — direct URL
   `https://supabase.com/dashboard/project/<ref>/functions/secrets` (add each key, then
   Save). Secrets are available immediately, no re-deploy needed.

   | Secret | Required | Notes |
   |---|---|---|
   | `LLM_API_KEY` | yes | OpenAI-compatible key (OpenAI, Groq, DeepSeek, local proxy, …) |
   | `LLM_MODEL` | yes | model id sent in the chat completions body, e.g. `gpt-4o-mini` |
   | `TAVILY_API_KEY` | no | absent → the Tavily source is skipped, Overpass only |
   | `LLM_BASE_URL` | no | default `https://api.openai.com/v1`; set to override the OpenAI-compatible endpoint |

   `SCRAPE_GEO_API_KEY` is dead — do not set it.
5. **Deploy.** Keep `verify_jwt` ON (default): the client calls
   `supabase.functions.invoke('scrape-and-analyze')` with the Supabase JWT, and row writes
   are guarded by RLS, not by the function.
6. Smoke check with the Dashboard's built-in tester (Edge Functions → the function →
   **Test**): a valid-shaped POST returns `{ candidates, analysis }` and a malformed body
   returns `400` / `invalid_request`. A 503 `providers_not_configured` means a required
   secret is missing on the function.

### Providers in play (dev-grade, no SLA)

| Concern | Provider | Endpoint | Guardrails built into the adapters |
|---|---|---|---|
| Geocode | Nominatim | `nominatim.openstreetmap.org` | 1 req/s throttle, identifying User-Agent |
| Drive time | OSRM public demo | `router.project-osrm.org` | 5s timeout per call in pipeline |
| Local listings | Overpass API | `overpass-api.de` | 25s query timeout, 50-element cap, 5s source interval, 15 km search radius |
| Web search | Tavily | `api.tavily.com/search` | 3s source interval, 10 results/query |

Notes:
- Overpass searches a **fixed 15 km radius**; the pipeline's real drive-time filter
  (`radiusMinutes`) is authoritative and drops anything beyond it.
- Overpass is only wired for domains that have a tag mapping (`DOMAIN_OVERPASS_TAGS` in
  `sources.ts` — currently `coffee-espresso` → café/coffee-shop tags). New domains need a
  mapping row there, mirroring the `domain_branches` seed discipline.
- Public endpoints are rate-limited and not a production SLA — revisit per
  `04-scraping-and-sentiment.md` source discipline before broad crawling.
- The LLM adapter uses `response_format: json_object` + a zod schema; anything the LLM
  returns that fails the schema degrades that candidate's analysis to `null` (batch survives).

## Part C — End-to-end test checklist (Step 4 of `08`)

Run the app (`npm run dev`), then tick:

1. [x] **Research flow:** home prompt → gate → run → `scrape-and-analyze` returns real
   candidates + analysis → results render → report generates at `/report` (matrix / Top 3 /
   Anti-Picks with real reasons). Verified: full gate run (Capsule → Entry Espresso), 10
   Tavily candidates + per-candidate LLM analysis; report shows Top 3 / matrix / Anti-Picks.
2. [x] **Fast Track** from the gate → broad pull → report. Verified: `fastTrack=1` skips the
   gate straight to the run form (fallback tiers), run completes, report renders as "broad pull".
3. [x] **History:** sign in after a guest run → promotion adopts session + candidates + analysis
   + report (no duplicates); list shows Complete / Fast Track / In progress; **Open /
   Continue / Refine / Run again** behave (Refine on in-progress resumes the exact question).
   Verified 2026-08-16 with test user `converge.test@example.com` (password
   `ConvergeTest123!`): guest draft → Save to account → `/signin?intent=promote` → sign in →
   promotion creates the session and adopts candidates/analysis/report (10 candidates, 9
   analyses, 1 report in DB; guest IndexedDB record cleared on success). **Refine** clones the
   session (resolution preserved) and resumes at the pull step without re-answering;
   **Run again** clones fresh with the same answers. Both clones list as Complete; opening a
   clone with no report yet shows "No report here yet." (not an error).
   ⚠️ **Blocked on an RLS bug until migration `0009`:** the first attempt failed with
   "infinite recursion detected in policy for relation reports" (42P17) — see the note in
   Part D / the migration itself. Fixed + re-verified.
4. **Sharing, RLS probes** (run in SQL Editor + a second browser profile):
   - User B cannot read user A's sessions/reports directly.
   - After a `user` grant, B can read report + candidates + analysis; revoke → 0 rows again.
   - Public link: create in the share sheet → open `/r/<token>` in an incognito/anon context
     → read-only report renders; tampered or revoked token → "This report isn't available".
   - `shares.token_hash` is sha256, never the raw token (search the DB dump).
5. **Edge cases:** drive-time filtering drops listings beyond the radius; `maxResults` cap
   honored; a dead provider (e.g. Tavily key wrong) degrades per-candidate/source, not the
   whole batch; cancel mid-run works.
6. **Checks:** `npm run lint && npm run typecheck && npm run test && npm run build`;
   impeccable detector over touched files; `supabase db advisors` clean.

## Open items to decide while testing

- Exact sharing UX copy and whether public links should expire (`revoked_at` already supports it).
- Email-based user resolution UX (currently a plain email field + `resolve_user_id_by_email`).
- `coverageScore` in the synthesis engine approximates "distinct sources" with evidence
  density until adapters tag each pro/con with its source.
- Whether the broad fallback gate gets promoted into seeded catalog content once
  LLM-generated gates land.
- Overpass tag mappings per domain (content-like; extend `DOMAIN_OVERPASS_TAGS`).
- Provider cache tables (e.g. geocode cache to respect Nominatim's 1 req/s) — deferred, per
  `08` Step 3; the in-memory throttle covers a single run.
- **Candidate relevance (observed in E2E):** Tavily returns off-topic results on broad
  queries — "best espresso machine under $600" surfaced espresso-bean and general coffee
  pages (The Takeout, Serious Eats, bean shops) alongside real machine reviews. Tavily's
  `query` is passed through unmodified from the gate; tightening the query
  (e.g. appending the domain + excluding purchase-adjacent content) or filtering candidate
  titles downstream is an open improvement. Same root cause as the source-discipline item
  in `04`.

## Part D — RLS recursion bug found + fixed in E2E (migration `0009`)

**Symptom:** every signed-in read on the report family returned HTTP 500 with
`infinite recursion detected in policy for relation reports` (Postgres 42P17). It broke
guest promotion (adoption aborted, empty session left behind, guest data kept) and any
report/history load for an authenticated user.

**Root cause:** `reports shared read` (0007) subqueries `shares`, and every
`shares owner *` policy subqueries `reports` — a direct mutual cycle. RLS policy
subqueries on two tables that reference each other cannot terminate.

**Fix (`20260816190743_fix_share_rls_recursion.sql`):** added a `SECURITY DEFINER` helper
`api.user_can_read_report(report_id)` (same sanctioned pattern as `api.get_shared_report`,
execute revoked from `public`, only `authenticated`) and rewrote `reports shared read` to
`using (api.user_can_read_report(reports.id))`. The helper runs with definer privileges, so
the policy never re-enters `shares` RLS — the cycle is broken without changing what rows
are visible. Grantee semantics (live `user` grants only, `granted_to = auth.uid()`) are
identical.

**Lesson for future schema work:** beware RLS policies that mutually reference each other's
tables (reports ↔ shares, and any shares/report joins in candidate/analysis shared-read
policies). Break cycles through a definer helper in the `api` schema rather than trying to
join both ways in policy `USING` clauses.
