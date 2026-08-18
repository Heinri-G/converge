# 12 — Intent-Grounded Gate: Catalog-Grounded Questions + Source Loop

> **Pillar:** Adaptive Domain Mapping (1) + Scraping (3) + Synthesis (4) · **Order:** 12 ·
> **Depends on:** 03, 08, 11
> **Goal:** make the gate questions feel like real research variables. For a tent the user
> expects to be asked about occupancy, waterproofing, blackout, season — and those answers
> must steer what gets scraped and what the comparison matrix compares. Solved with a
> **self-populating attribute catalog**: LLM-first for signed-in users, grounded in catalog
> content; deterministic picker for guests; generated gates promoted to permanent catalogs
> on first use.

## Why

For non-seeded domains (tents, bikes, laptops…) the gate asked one abstract
prioritization question (or nothing), the parser was attribute-blind, and the answers never
reached the scrape or the report — so the research felt decorative. The domain-attribute
knowledge lived in a single example line inside an LLM prompt, and the catalog tables were
read-only with no runtime promotion path.

## Decisions locked in (user-confirmed)

1. **Full loop:** questions → parsing → source narrowing → spec extraction → comparison columns.
2. **LLM-first, catalog-grounded:** `generate-gate` picks 2–3 unanswered attributes *from the
   catalog* for signed-in users; guests get the identical questions via a deterministic
   picker (they cannot call the JWT-gated function).
3. **2–3 high-impact questions** by default (Fast Track unchanged).
4. **Self-populating catalog:** seeds are bootstrap only; the expansion mechanism is
   generate-on-first-use → `promote-catalog` → serve. Promotion is automatic, no human review.
5. **`promote-catalog` is the single documented exception** to "Edge Functions never write to
   the DB" — validated, anti-spam-guarded (caller must own a research session for the domain),
   and never overwrites authored/curated catalogs.

## Changes

### Data model (migration `0010_domain_catalog_v2`)

- `domain_catalogs` — header per domain (`__core__` = applies to all), `status`
  (`draft`/`curated`), `source` (`authored`/`generated`), `created_by`. T4 public read.
- `domain_attributes` — rows: `slug`, `label`, `prompt`, `tooltip`, `answer_type`,
  `options jsonb`, `keywords text[]` (prompt detection), `priority`, `ordering`,
  `target_kind`/`target_field`/`target_value_type` (deterministic mapping onto
  `ResearchIntent`). T4 public read.
- Seeds: `__core__` (budget / min rating / availability), `coffee-espresso` (ported from the
  seeded gate questions), `tents` (occupancy / waterproofing / season / blackout / packability).

### Client (`src/`)

- `lib/research-intent.ts` — `detectAnsweredAttributeSlugs` / `answeredAttributeValues`
  (keyword-based, word-boundary aware) so the gate skips attributes the prompt already
  states; `specAttributesFromPreferences` derives the spec schema from settled preferences.
- `features/stage-gate/api.ts` — `fetchCatalog(domainSlug)` returns the domain catalog +
  attributes + core attributes; `fetchDomainSlugs` now reads `domain_catalogs`.
- `features/stage-gate/catalogPicker.ts` — deterministic top-2–3 unanswered attributes,
  emitted in the generated-gate shape so `GroupSheet` renders them unchanged.
- `features/stage-gate/GateWizard.tsx` — unified catalog-first flow: catalog exists → serve
  (LLM picks for signed-in, picker for guests); no catalog → signed-in generates + promotes
  best-effort, guest uses core picker. Legacy branch resume path kept for old snapshots.
- `features/stage-gate/promoteCatalog.ts` — best-effort client call to `promote-catalog`.
- `features/research/ResearchRun.tsx` — sends `specAttributes` on the scrape request.
- `features/synthesis/engine.ts` + `ComparisonMatrix.tsx` — matrix rows carry `specs` from
  `candidate.data.specs`; the matrix renders them as columns (mobile card lines + desktop
  table columns).

### Edge Functions (`supabase/functions/`)

- `generate-gate/gate.ts` — system prompt + user prompt now include the domain's attribute
  catalog and the already-answered slugs; the model *selects* from the catalog verbatim
  (prompt/tooltip/options/target), only improvising when the catalog is empty.
- `promote-catalog/index.ts` — validates the gate (same shape/sanitization as
  `generate-gate`), verifies ownership via the caller JWT under RLS, upserts a
  `source='generated'` catalog via service role, supersedes the previous generated draft.
- `scrape-and-analyze/` — `RequestBody.specAttributes` validated and passed through;
  `specs.ts` adds an LLM spec-extraction pass (`data.specs`) that degrades per candidate;
  `sources.ts` gains Overpass tag mappings for restaurants/hotels/golf.

## Verification

1. `npm run lint && npm run typecheck && npm run test && npm run build`.
2. Playwright at **390px** and **1440px**: tent prompt → gate asks occupancy/waterproofing/
   blackout (or skips what the prompt states) → "Ready to search" → find → report shows the
   answered attributes as comparison columns. Guest path shows the identical questions.
3. Repeat research for the same domain → catalog serves deterministically (no regeneration).
4. `promote-catalog` rejects a caller with no research session for the domain (403).

## Acceptance checklist

- [ ] New gates select from the attribute catalog; unknown domains generate + promote on first use
- [ ] Guests and LLM-failure paths use the same catalog questions via `catalogPicker`
- [ ] Prompt-stated attributes are detected and skipped by the gate
- [ ] Scrape extracts the answered attributes into `candidate.data.specs`
- [ ] Comparison matrix renders spec columns from those specs
- [ ] `promote-catalog` is the only runtime writer to the catalog tables and never overwrites curated
- [ ] Migration `0010` seeds `__core__`, coffee-espresso, and tents catalogs
- [ ] Lint/typecheck/test/build green; impeccable detector run over touched UI files

## Implementation notes (built)

- The catalog tables' target columns let `applyGateAnswers` map answers deterministically —
  the LLM supplies structure (which questions), never logic (what a value means).
- `applyGate` persists `complete` immediately when a gate has no unanswered questions, so
  fully-answered prompts flow straight to the run form.
- Overpass remains a place-domain source; product domains rely on Tavily + spec extraction.