# 04 — Localized Scraping & Red-Flag Sentiment

> **Pillar:** Localized Scraping & Red-Flag Sentiment (3) · **Order:** 5 · **Depends on:** 01, 03
> **Goal:** turn a finalized gate into scraped, geo-filtered candidates with LLM-extracted consensus pros/cons and recurring defects — all executed server-side in an Edge Function, persisted via RLS-guarded client writes.

References: ARCHITECTURE.md (pillar flow 3, Edge Functions, open decisions), AGENTS.md (Security: untrusted content, server-side validation).

## Decisions locked in

- **Edge Functions are stateless executors.** `scrape-and-analyze` returns normalized `{ candidates, analysis }`; the client persists rows (RLS-guarded). The function never writes the DB and never uses `service_role`.
- **Adapter interfaces, vendor open** (per ARCHITECTURE.md): `SourceAdapter` (per scrape source), `GeoAdapter` (drive-time), `SentimentAdapter` (LLM). Only the function's env secrets name concrete providers — nothing in the bundle.
- Keys live in function secrets: `SCRAPE_GEO_API_KEY`, `LLM_API_KEY`, `LLM_MODEL`. Never `VITE_*`.
- Scraped text is **untrusted**: stored as text, rendered escaped; no `dangerouslySetInnerHTML` (AGENTS.md).
- Server-side validation is authoritative: the function rejects malformed/bounded-violating input before any scraping.

## Step 1 — Tables (migration `0003_candidates_analysis`)

```sql
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  source text not null,              -- adapter id: 'local' | 'reddit' | 'forum' | 'web'
  source_url text not null,
  name text not null,
  geo jsonb not null default '{}'::jsonb,   -- { lat, lng, driveMinutes, address? }
  rating numeric,                            -- 0..5 where the source provides one (nullable)
  data jsonb not null default '{}'::jsonb,   -- normalized scraped fields, source-specific
  created_at timestamptz not null default now()
);

create table public.analysis (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  sentiment_score numeric not null check (sentiment_score between -1 and 1),
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  defects text[] not null default '{}',      -- recurring defects = red flags
  source_summary text not null default '',
  model text not null default '',            -- LLM model id used
  created_at timestamptz not null default now()
);

alter table public.candidates enable row level security;
alter table public.analysis  enable row level security;
-- policies per template T2 (session join), all four verbs
```

Indexes: `candidates(session_id)`; `analysis(candidate_id)` (PK already covers).

## Step 2 — Edge Function `scrape-and-analyze`

`supabase/functions/scrape-and-analyze/index.ts`. Input contract:

```ts
type RequestBody = {
  query: string            // from the gate: root query or tier-narrowed query
  domainSlug: string
  geo: { address?: string; lat?: number; lng?: number }
  radiusMinutes: number    // drive-time radius cap
  tier: 'broad' | Tier     // 'broad' = root-tier pull (05 fast-track uses this)
  maxResults: number
}
```

Response: `{ candidates: CandidateDraft[], analysis: Record<string, AnalysisDraft> }` keyed by a stable per-candidate id (`candidate-1`, …). Return type shapes go in `src/lib/types.ts` (imported by both sides' interfaces; duplicated only in the Deno function where cross-import is impractical — keep the field names identical).

**Pipeline, in order:**

1. **Validate (authoritative).** Required fields, types; `query.trim()` length 2–200; `radiusMinutes` 1–120; `maxResults` 1–50; `geo` needs `address` or `{lat,lng}`. Reject 400 with a machine-readable error. **No URL/path built from user input** (OWASP).
2. **Geocode + drive-time** via `GeoAdapter.resolve(address)` then `GeoAdapter.driveMinutes(from, to)`. Adapter interface:

   ```ts
   interface GeoAdapter {
     resolve(address: string): Promise<{ lat: number; lng: number }>
     driveMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number>
   }
   ```

3. **Scrape** via `SourceAdapter` registry (`local`, `reddit`, `forum`, `web`), each returning `RawListing[]`. Per-source guardrails: robots/ToS check, per-host rate limit (token bucket), max page budget, short timeout. Vendor-open; add sources by registering adapters, not by editing the pipeline.

   ```ts
   interface SourceAdapter {
     id: string
     fetch(query: string, geo: GeoPoint, radiusMinutes: number): Promise<RawListing[]>
   }
   ```

4. **Filter + normalize** → `CandidateDraft[]`: drop listings beyond `radiusMinutes` (drive-time), dedupe by URL, keep the fields in the table.
5. **Sentiment** via `SentimentAdapter.analyze(listing, context)` → `AnalysisDraft`. Prompt contract (provider-agnostic): given the scraped review/comment text for one candidate, return **strict JSON**: `{ sentimentScore: -1..1, pros: string[], cons: string[], defects: string[], summary: string }`. `defects` must capture **recurring** defect mentions ("multiple owners report X"). Parse defensively; on parse failure return a `null` analysis for that candidate (don't fail the batch).
6. **Return** `{ candidates, analysis }`. Do not persist.

Env: `LLM_API_KEY`, `LLM_MODEL`, `SCRAPE_GEO_API_KEY`. Function is **not** created with `--no-verify-jwt`; callers pass the Supabase JWT (guest or signed-in — either is fine; the function is a compute endpoint, authorization is the client's RLS).

## Step 3 — Client: invocation + progress + persist

`src/features/research/`:
- `api.ts` — `runScrapeAndAnalyze(session, input)` calls `supabase.functions.invoke('scrape-and-analyze', { body })`.
- `runResearch.ts` — orchestrates: (1) invoke, (2) `insert` candidates, (3) `insert` analysis keyed by candidate id, (4) update session `resolution` (left `in_progress` until `05`/`06` finish). Wraps steps 2–3 in one screen-level transaction-ish sequence; on partial failure, keep what persisted and surface a retry for the rest (idempotent by `source_url` unique guard).
- `ProgressScreen.tsx` — mobile-first status surface: step list (Geocoding → Scraping → Filtering radius → Analyzing sentiment) with a live phase; on phones a bottom-anchored progress card; on desktop a centered card. Cancel button (44px) aborts the invoke.
- Rendering candidates: name/URL/rating as **text** (React escapes by default); any source field rendered via `{text}` interpolation, never `dangerouslySetInnerHTML`.

## Step 4 — Untrusted-content guard

Before shipping: grep `dangerouslySetInnerHTML` across `src/` — zero matches. Any future raw-HTML need goes through an allowlist sanitizer (AGENTS.md) with review.

## Verification

1. Function unit checks: malformed body → 400; valid body with a **fake adapter** (test stub) returns normalized candidates; sentiment stub returns the strict JSON shape.
2. With real adapters, bounded: `maxResults` respected, radius filter applied, no URL built from input.
3. Playwright at 390px + 1440px: run research → progress phases render, no overflow; results appear; cancel works.
4. RLS: candidates/analysis inserted by owner read back only by owner (T2 probe).
5. Secret scan: `rg -i "api_key|LLM_API_KEY|SCRAPE_GEO" src/` → no matches.
6. `npm run lint && npm run typecheck`; impeccable detector over changed files once.

## Acceptance checklist

- [ ] `scrape-and-analyze` validates authoritatively and returns `{ candidates, analysis }` without writing
- [ ] Source / Geo / Sentiment adapters are interfaces; providers set only via function secrets
- [ ] Drive-time radius filtering is real (listings beyond radius dropped)
- [ ] Sentiment returns strict JSON with pros/cons/**defects**; parse failures degrade per-candidate, not the batch
- [ ] Client persists rows RLS-guarded; retry is idempotent
- [ ] Progress UI verified at 390px and 1440px
- [ ] Zero `dangerouslySetInnerHTML`; zero secrets in `src/`

## Follow-ups

- `05-anti-rabbit-hole` uses `tier: 'broad'` for the Fast Track pull.
- `06-synthesis` consumes `analysis.pros/cons/defects/sentiment_score` to build the matrix, Top 3, and Anti-Picks.
- Open: exact sources + ToS/rate-limit review, geo provider, LLM provider (all swap at the adapter boundaries).
