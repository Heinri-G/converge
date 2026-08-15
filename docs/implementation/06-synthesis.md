# 06 — Actionable Synthesis

> **Pillar:** Actionable Synthesis (4) · **Order:** 7 · **Depends on:** 04, 05
> **Goal:** generate the decision-ready deliverable: a structured comparison matrix, Top 3 Recommended Options, and an explicit "Options to Avoid" (Anti-Picks) list with reasons — deterministic and testable.

References: ARCHITECTURE.md (pillar flow 4), PRODUCT.md (Actionable synthesis).

## Decisions locked in

- Synthesis is **pure, deterministic app logic** (`src/features/synthesis/engine.ts`) — same inputs, same outputs. Unit-tested with fixtures. Not an Edge Function.
- `reports` persists one row per completed session (RLS template T2); `top_3`, `anti_picks`, and `matrix` are JSONB — the schema stays stable while ranking rules evolve.
- **Anti-Picks are rule-based, with reasons pulled from `analysis`:** a candidate is a pick-to-avoid when it shows recurring defects, or a sentiment/price mismatch (see rules below). Reasons must cite actual `analysis.defects`/`cons`, never invented claims.
- Mobile-first: the matrix **reflows to stacked cards on phones** (one candidate per card, per the table→card pattern), and a full matrix table on `min-width: md`+.

## Step 1 — `reports` table (migration `0004_reports`)

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  title text not null,
  matrix jsonb not null default '[]'::jsonb,     -- MatrixRow[]
  top_3 jsonb not null default '[]'::jsonb,      -- RankedOption[]
  anti_picks jsonb not null default '[]'::jsonb, -- AntiPick[]
  created_at timestamptz not null default now(),
  unique (session_id)
);

alter table public.reports enable row level security;
-- policies per template T2 (session join), select/insert/update/delete
-- (07 adds the shared-read policy on top)
```

Types (`src/lib/types.ts`):

```ts
export interface MatrixRow {
  candidateId: string
  name: string
  sourceUrl: string
  tier: Tier | 'broad'
  driveMinutes: number | null
  rating: number | null
  sentimentScore: number
  priceBand: 'low' | 'mid' | 'high' | null   // from normalized data when the source provides it
  prosCount: number
  consCount: number
  defectsCount: number
  compositeScore: number  // 0..1, from rankScore()
}

export interface RankedOption { candidateId: string; name: string; reason: string; rank: number }
export interface AntiPick {
  candidateId: string
  name: string
  reason: string          // cites analysis.defects/cons
  redFlag: 'defects' | 'overhyped'
}
```

## Step 2 — Engine (`src/features/synthesis/engine.ts`, pure)

Expose `synthesize(session, candidates, analysis): { matrix, top_3, anti_picks }`. Deterministic rules (all constants named and centralized):

- **`rankScore(candidate, analysis)`** — weighted, documented:
  - `0.5 * sentimentScore` (normalized to 0..1)
  - `0.2 * proximity` (higher = closer; `driveMinutes` null → neutral)
  - `0.2 * sourceCoverage` (more distinct sources pros/cons are drawn from = more consensus)
  - `0.1 * priceBand` (preference toward mid for the coffee domain default; configurable per domain later)
  - Tie-break: `rating`, then `name` (stable ordering — no randomness).
- **`top_3`** — the three highest `compositeScore`, each with a one-line `reason` citing its strongest analysis dimension.
- **`antiPicks`** — either rule fires:
  - `defects`: `analysis.defects.length >= 2`, reason = the defect strings.
  - `overhyped`: `sentimentScore > 0.4` **and** `rating >= 4` **and** `cons.length >= 3` (glowing score but material unresolved cons) — the "overhyped" signature. Reason = the top `cons` plus a note.
- Guard: a candidate in both lists resolves to Top 3 (recommendation wins; note the tension in the reason).

`MatrixRow.compositeScore` reuses `rankScore`. Exclude any candidate whose `analysis` is missing (null) from `top_3` but keep it in the matrix flagged `sentimentScore: null`.

## Step 3 — Report screen (`src/features/synthesis/`)

- `ReportScreen.tsx` — loads session + candidates + analysis + report (or runs `synthesize` when no report row exists yet and persists it).
- `ComparisonMatrix.tsx` — **mobile (base): stacked cards**, one candidate per card; each row visible as a labeled line (name, drive time, rating, sentiment, defects count, composite). **`min-width: md`: true table** with the same columns. Both from the same `MatrixRow[]`.
- `TopThree.tsx` — three ranked cards, rank badges, reason lines.
- `AntiPicks.tsx` — "Options to Avoid" list, each with red-flag badge (`defects`/`overhyped`) and the reason citing defects/cons.
- A "Start a new research" (guest) / "Save report" (signed-in; persists automatically) affordance, 44px+.
- Everything renders `name`, `sourceUrl`, and `reason` as escaped text.

## Step 4 — Idempotent persist

`saveReport(report)` upserts by `session_id` (unique constraint) so reruns and fast-track retries never duplicate rows.

## Verification

1. `vitest run src/features/synthesis` — fixtures: identical input → identical output (deterministic); tie-break stable; `defects` and `overhyped` rules each fire on a fixture; null-analysis candidates excluded from Top 3.
2. Playwright at **390px**: report shows stacked matrix cards, Top 3, Anti-Picks with reasons; no overflow; at **1440px**: matrix table renders; same data.
3. Persistence: report row upserts once; rerun doesn't duplicate.
4. `npm run lint && npm run typecheck`; impeccable detector once.

## Acceptance checklist

- [ ] Matrix, Top 3, Anti-Picks all present and deterministic (unit-proven)
- [ ] Anti-Pick reasons cite real `analysis` content (defects/cons), nothing invented
- [ ] Null-analysis candidates flagged, not dropped, and excluded from Top 3
- [ ] Report upserts idempotently by `session_id`
- [ ] Verified at 390px (cards) and 1440px (table)
- [ ] No `dangerouslySetInnerHTML`; text escaped

## Follow-ups

- `07-storage-history-sharing` adds history, reopen/increment, and sharing (with the T3 read policy on `reports`).
- Ranking constants may become per-domain content later; today they are named constants in `engine.ts`.
