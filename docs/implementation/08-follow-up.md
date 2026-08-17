# 08 — Follow-Up: Apply Config, Deploy, Test End to End

> **Status:** migrations `0001`–`0008` defined (the first seven applied by hand; `0008`
> grants `USAGE` on the `api` schema); **provider adapters are implemented (Step 3 done)** —
> `config.toml` exposure, Edge Function deploy + secrets, and the E2E test are still open.
> Only after this file's steps can the app be tested end to end. The exact deploy walkthrough
> + E2E checklist now live in `09-dashboard-deploy.md`.

The Supabase CLI wasn't on this machine; schema work is done in the Dashboard SQL Editor and
code changes are pushed to the repo. The function deploy itself needs the CLI — install it
with `npm i supabase` and follow `09-dashboard-deploy.md` Part B.

## Step 1 — Expose the `api` schema

The repo's `supabase/config.toml` already lists `["public", "graphql_public", "api"]` (committed in `38f94ad`), but the cloud project must also expose the schema to PostgREST:

- **Supabase Dashboard → Integrations → Data API → Settings → Exposed schemas → add `api`** (direct URL `…/integrations/data_api/settings`; the old **Settings → API** path redirects there). The schema lives inside `0007_shares.sql`, so apply the dashboard setting after the migration.
- **Also grant `USAGE` on the `api` schema** — `0008_api_schema_grants.sql` does this, but if `0007` was applied before that migration existed, run `grant usage on schema api to anon, authenticated;` in the SQL Editor (PostgREST needs both schema `USAGE` and function `EXECUTE`).
- Verify: `supabase.rpc('get_shared_report', ...)` and `supabase.rpc('resolve_user_id_by_email', ...)` stop returning `404`/function-not-found.

## Step 2 — Deploy `scrape-and-analyze` and set secrets

```bash
supabase functions deploy scrape-and-analyze
supabase secrets set LLM_API_KEY=<key> LLM_MODEL=<model>
```

- Required today by the function (`supabase/functions/scrape-and-analyze/index.ts` checks both): `LLM_API_KEY`, `LLM_MODEL`.
- `SCRAPE_GEO_API_KEY` is **no longer required** — do not set it.
- `verify_jwt` default is fine: the client calls `supabase.functions.invoke('scrape-and-analyze')`, and row writes are guarded by RLS, not the function.

## Step 3 — Wire the concrete provider adapters (done)

Implemented in `supabase/functions/scrape-and-analyze/` and swapped into `index.ts`
(`buildDependencies` replaces the old `notConfiguredDependencies()` stub):

- `geo.ts` — **Nominatim** geocode (1 req/s throttle, identifying UA) + **OSRM** drive time (duration → whole minutes).
- `sources.ts` — **Overpass** (15 km fixed search radius, domain tag mapping, `out center 50`) + **Tavily** (10 results, content text). Tavily is skipped when `TAVILY_API_KEY` is unset.
- `sentiment.ts` — **LLM via OpenAI-compatible chat completions** (`LLM_BASE_URL` optional, default `https://api.openai.com/v1`), `response_format: json_object`, zod-validated strict JSON (`{ sentimentScore, pros, cons, defects, summary }`).
- `pipeline.ts` — per-source and per-drive-time failure now degrade the batch instead of failing it.
- Secrets: `LLM_API_KEY`, `LLM_MODEL` required; `TAVILY_API_KEY` optional; `LLM_BASE_URL` optional. `SCRAPE_GEO_API_KEY` dropped from `.env`.

Commit: adapters + tests + docs (`08` status, `09-dashboard-deploy.md`) as a follow-up PR.
No provider cache migration added (functions stay stateless per ARCHITECTURE.md); the in-memory throttles cover a single run.

## Step 4 — Test end to end

Run the full loop and tick these off:

1. **Research flow:** home prompt → gate → run → `scrape-and-analyze` returns real candidates + analysis → results render → report generates at `/report` (matrix / Top 3 / Anti-Picks with real reasons).
2. **Fast Track** from the gate → broad pull → report.
3. **History:** sign-in after a guest run → promotion adopts session + candidates + analysis + report (no duplicates); list shows Complete / Fast Track / In progress; **Open / Continue / Refine / Run again** behave (Refine on in-progress resumes the exact question). **Verified 2026-08-16** (test user `converge.test@example.com`); see `09` Part C item 3 and the RLS fix in `09` Part D / migration `0009`.
4. **Sharing, RLS probes:**
   - User B cannot read user A's sessions/reports directly.
   - After a `user` grant, B can read report + candidates + analysis; revoke → 0 rows again.
   - Public link: create in the share sheet → open `/r/<token>` in an **incognito/anon** context → read-only report renders; tampered or revoked token → "This report isn't available".
   - `shares.token_hash` is sha256, never the raw token (`rg` the DB dump).
5. **Edge cases:** drive-time filtering drops listings beyond the radius; `maxResults` cap honored; provider failures degrade per-candidate (not the whole batch); cancel mid-run works.
6. **Checks:** `npm run lint && npm run typecheck && npm run test && npm run build`; impeccable detector over touched files; `supabase db advisors` clean.

## Open items to decide before/while testing

- Exact sharing UX copy and whether public links should expire (`revoked_at` already supports it).
- Email-based user resolution UX (currently a plain email field + `resolve_user_id_by_email`).
- `coverageScore` in the synthesis engine approximates "distinct sources" with evidence density until adapters tag each pro/con with its source.
- Whether the broad fallback gate gets promoted into seeded catalog content once LLM-generated gates land.
- Overpass tag mappings per domain (`DOMAIN_OVERPASS_TAGS` in `sources.ts`; content-like, mirrors the `domain_branches` seed discipline).
- Production SLA for geo/search providers (currently public rate-limited endpoints — see `09`).

## Implementation notes (built)

- **`generate-gate` function added** (`supabase/functions/generate-gate/`) — LLM-generated, per-session stage gates grouped by clarification type, zod-validated, cost-capped (≤2 groups, ≤2 questions per group), JWT-required. Deploy alongside `scrape-and-analyze` (`supabase functions deploy generate-gate`); it reuses `LLM_API_KEY`/`LLM_MODEL`/`LLM_BASE_URL` secrets — no new secrets.
- **Synthesis is objective-aware:** `synthesize()` now accepts `SynthesisSource.objective` (persisted in `stage_state` at gate/run time); `best_value`/`lowest_cost` up-weight price and favor the low price band, `highest_quality` up-weights sentiment, `closest` up-weights proximity.
- **Guest sessions stay local:** the generated gate is only invoked for signed-in sessions; guests and generation failures use the intent-aware deterministic fallback (`src/features/stage-gate/fallback.ts`). See the 03 implementation notes for the full flow-fluidify changes.
