# 10 — E2E Testing: Critical Info for Scaffolding Automated Tests

> Status note: manual E2E verification is done (see `09` Part C). No automated E2E specs
> exist yet — `@playwright/test` is an installed-but-unused devDependency and there is no
> `playwright.config.*` or `e2e/` directory. This file records everything needed to scaffold
> `npx playwright test` specs later without re-discovering the hard-won details below.

## Environment facts (verified 2026-08-16)

- **Dev server port:** `npm run dev` serves on **5176** (5173–5175 are occupied on this
  machine). Playwright specs must target `http://localhost:5176` unless ports free up.
- **Supabase project (live, linked):** `oqqlbbdwxqornngpxmkd.supabase.co`, ref
  `oqqlbbdwxqornngpxmkd`. CLI is installed via npm (`npx supabase`, v2.114.0) and logged in.
- **Test user (password auth):** email `converge.test@example.com`, password
  `ConvergeTest123!`. Note the password has **no dot** between "Converge" and "Test" —
  the previously recorded `Converge.Test123!` is wrong and returns
  `invalid_credentials`. Email is confirmed. Used for sign-in + guest-promotion flows.
- **Provider secrets:** LLM key/model + Tavily key live in function secrets / gitignored
  `.env` (`supabase/functions/.env`). `LLM_BASE_URL` defaults to `https://api.openai.com/v1`;
  the earlier "all analyses null" incident was a wrong base URL, not code.
- **Schema/applied-migration workflow:** remote DB has **no migration history rows** — schema
  was applied by hand (Dashboard SQL Editor / `supabase db query --linked`). `supabase db
  push` from scratch would re-apply everything; to ship a single change, run its SQL via
  `supabase db query --linked -f <file>` and keep the migration file in
  `supabase/migrations/` for the record. `supabase migration list --linked` shows blank
  Remote column for all rows.

## Known pitfalls (do not re-hit these in automated runs)

1. **RLS infinite recursion (FIXED in `0009`).** `reports shared read` referencing `shares`
   plus `shares owner *` referencing `reports` is a policy cycle → every signed-in report
   read (and guest promotion) died with `42P17 infinite recursion detected in policy for
   relation reports`. Fixed by a SECURITY DEFINER helper `api.user_can_read_report(uuid)`
   in the `api` schema (execute revoked from `public`). If report reads 500 again, suspect a
   new policy re-introducing a cross-table cycle. See `09` Part D.
2. **Wrong test-user password** (see above). If sign-in returns `invalid_credentials` (400),
   re-check the password before touching auth code.
3. **`api` schema exposure:** PostgREST needs `GRANT USAGE ON SCHEMA api TO anon,
   authenticated` (`0008`) or the RPCs return 404/function-not-found.
4. **Guest promotion is one-shot:** `promoteGuestSession` clears the IndexedDB guest record
   on success. A failed run (RLS 500) left an empty session row behind and kept the guest
   data, so re-navigating to `/signin?intent=promote` after signing in re-triggered
   promotion. Specs should assert the DB row count, not just the UI.
5. **Tavily off-topic results** on broad queries (candidate relevance, see `09` open items) —
   assertions on candidate *content* should be tolerant; assertions on *counts* are stable.
6. **Playwright MCP caps waits (~5s)** and is flaky on long async research runs. For
   automation prefer polling short waits or longer explicit `expect(...).toPass()`-style
   retries rather than fixed sleeps.

## Flows that are verified and safe to encode as specs

- **Research flow (gate → run → report):** home prompt → Deploy research → gate answers →
  Run research → candidates + analysis → report at `/report` (Top 3 / matrix / Anti-Picks).
- **Fast Track:** `fastTrack=1` (skip gate) → broad pull → report tagged "Broad pull".
- **History / promotion:** guest run → `/history` shows local draft → Save to account →
  `/signin?intent=promote` → sign in → session adopts candidates/analysis/report (no dupes);
  **Open report**, **Refine** (clone, resume at pull step, no re-answer), **Run again**
  (fresh clone, same answers). Clone with no report yet shows "No report here yet." (not an
  error). Status badges: Complete / Fast Track / In progress.
- **Sharing / RLS probes (Part C item 4):** cross-user isolation, `user` grant, public
  link `/r/<token>` in anon context, revoked/tampered token → "This report isn't available",
  `shares.token_hash` is sha256.

## Scaffolding checklist (when you build the specs)

1. `npx playwright install` (browsers) and create `playwright.config.ts`:
   `baseURL: 'http://localhost:5176'`, webServer `{ command: 'npm run dev', port: 5176,
   reuseExistingServer: true }` (or 5173 if ports free), a desktop + a mobile project for
   the mobile-first pass.
2. Add `e2e/*.spec.ts` under the four flow headings above. Use the **test user** creds as
   env/constants (do not hard-code the wrong password variant).
3. Assert **DB rows** (via `supabase db query --linked` in a setup/teardown helper or via
   the signed-in UI) for promotion/no-dup checks — UI-only assertions hid the empty-session
   bug before `0009`.
4. Run `npm run lint && npm run typecheck && npm run test` after scaffolding — `tsc -b`
   includes all of `src` only, so `e2e/` types are governed by the new config.
5. Keep migrations in `supabase/migrations/`; apply single changes with
   `supabase db query --linked -f <file>`.
6. Do not commit the test-user password to a public repo path; keep it in a local, gitignored
   file or env var if the repo is public. It is a disposable dev-account credential, not a
   production secret.
