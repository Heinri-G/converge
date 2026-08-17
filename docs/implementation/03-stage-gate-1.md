# 03 — Stage Gate 1: Adaptive Domain Mapping

> **Pillar:** Adaptive Domain Mapping (1) · **Order:** 4 · **Depends on:** 01
> **Goal:** segment a topic into tiers (Capsule → Manual Filter → Entry Espresso → Prosumer) and surface 2–3 high-impact branching questions, each with an inline ℹ️ tooltip explaining why the variable matters. Content-driven: new domains ship as seed data, no code.

References: ARCHITECTURE.md (pillar flow 1, data model), PRODUCT.md (Adaptive domain mapping).

## Decisions locked in

- Tiers, branches, questions, and tooltips are **content rows**, not JSX. `domain_branches` holds the tier tree (self-referencing, depth ≤ 2); `gate_questions` holds the branching questions with `tooltip` = "why it matters."
- RLS template **T4** (public catalog read, no writes) for both tables.
- The **flow controller is a pure state machine** in `src/features/stage-gate/flow.ts` — no I/O, unit-testable. It defines `MAX_DEPTH = 2` (enforced in `05`).
- A session's answers live in `research_sessions.stage_state` (JSONB) so any session can resume exactly where it stopped.
- Mobile-first: questions render as a **full-screen bottom sheet on phones** (thumb reach, one question per viewport) and as an inline card on `min-width: md`+.

## Step 1 — Content tables (migration `0002_domain_catalog`)

```sql
create table public.domain_branches (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.domain_branches(id) on delete cascade, -- NULL = root/tier base
  domain_slug text not null,              -- e.g. 'coffee-espresso'
  slug text not null,                     -- unique per domain, e.g. 'capsule'
  tier text not null
    check (tier in ('capsule', 'manual_filter', 'entry_espresso', 'prosumer')),
  label text not null,
  description text not null default '',
  ordering int not null default 0,
  unique (domain_slug, slug)
);

create table public.gate_questions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.domain_branches(id) on delete cascade,
  prompt text not null,
  tooltip text not null,                  -- "why this variable matters" — rendered by the ℹ️ control
  answer_type text not null check (answer_type in ('single', 'boolean')),
  options jsonb not null,                 -- [{ value, label }] for 'single'; [] for 'boolean'
  weight numeric not null default 1,      -- contribution to the tier decision (06 uses this)
  ordering int not null default 0
);

alter table public.domain_branches enable row level security;
alter table public.gate_questions  enable row level security;

create policy "catalog read" on public.domain_branches for select
  to anon, authenticated using (true);
create policy "catalog read" on public.gate_questions for select
  to anon, authenticated using (true);
```

Grant Data API access to both roles; RLS on.

## Step 2 — Seed content (coffee/espresso, the proof domain)

Seed a root branch and 2–3 questions with real tooltips. Example structure:

- `domain_branches`: `coffee-espresso/capsule` (root, tier capsule) ← children `entry_espresso`, `prosumer` (via `manual_filter` intermediate or direct).
- `gate_questions` under the root: "Is counter space or portability your priority?" (tooltip: "Machines split on footprint first — a prosumer unit is a counter fixture, not a travel appliance"), "How much time do you want to spend per drink?" (tooltip: "Time-per-drink is the hidden cost most reviews never state"), "How automated should the workflow be?" (tooltip: "Automation level predicts both price and how much routine you take on").

Seed the **tier labels** in content (Capsule / Manual Filter / Entry Espresso / Prosumer) as `domain_branches` rows per domain so copy is editable without a deploy. Add `0002` seed data inline in the migration.

## Step 3 — Shared types (`src/lib/types.ts`)

```ts
export type Tier = 'capsule' | 'manual_filter' | 'entry_espresso' | 'prosumer'

export interface DomainBranch {
  id: string
  parentId: string | null
  domainSlug: string
  slug: string
  tier: Tier
  label: string
  description: string
  ordering: number
}

export interface GateQuestion {
  id: string
  branchId: string
  prompt: string
  tooltip: string
  answerType: 'single' | 'boolean'
  options: { value: string; label: string }[]
  weight: number
  ordering: number
}

export interface GateState {
  domainSlug: string
  branchPath: string[]   // branch ids chosen, root first; length ≤ MAX_DEPTH
  answers: Record<string, string | boolean> // questionId -> answer
}
```

(`GateState` is what `stage_state` on the session stores.)

## Step 4 — Flow controller (`src/features/stage-gate/flow.ts`, pure)

```ts
export const MAX_DEPTH = 2

export function nextBranch(
  state: GateState,
  question: GateQuestion,
  answer: string | boolean,
): GateState
// - appends the answering branch to branchPath
// - clamps: never grows branchPath beyond MAX_DEPTH (05 hardens the UI too)
export function isAtMaxDepth(state: GateState): boolean
export function isComplete(state: GateState): boolean
```

No fetching here. Unit-test the controller (`vitest`) with fixtures before wiring UI.

## Step 5 — Data access (`api.ts`)

```ts
export async function fetchDomainBranches(domainSlug: string): Promise<DomainBranch[]>
export async function fetchGateQuestions(branchId: string): Promise<GateQuestion[]>
```

Both via `src/lib/db.ts` over the public catalog tables (template T4).

## Step 6 — UI (mobile-first)

`src/features/stage-gate/` components:
- `GateWizard.tsx` — orchestrates: pick domain → render current branch questions → on completion, finalize `stage_state` into the session and hand off to `05`/`04`.
- `QuestionSheet.tsx` — **mobile: bottom sheet** (slides up, one question per view, progress dots; answer buttons 44px+, stacked). **Desktop (`min-width: md`): inline card** with the same controls. Keyboard operable, `role="dialog"` on mobile, focus trapped, Esc closes, `aria-modal` when sheet.
- `Tooltip.tsx` — accessible ℹ️: a disclosure button (`aria-expanded`) revealing the `tooltip` text via `aria-describedby`; opens on tap/click/Enter; stays within safe-area on phones; also renders inline for screen readers.
- `Progress.tsx` — thin progress bar; updates from `branchPath.length / MAX_DEPTH`.

Resume: on mount, load the session's `stage_state` and restore the controller state; don't re-ask answered questions.

## Verification

1. `vitest run src/features/stage-gate` — controller state transitions, max-depth clamp, completion.
2. Playwright at **390px**: pick domain → bottom sheet slides up, one question per view, tooltips open and dismiss, no overflow; at **1440px**: inline cards, same flow.
3. Seed renders for `coffee-espresso`; tiers show Capsule → … → Prosumer ordering.
4. `npm run lint && npm run typecheck`.
5. Run the impeccable detector over the changed files once.

## Acceptance checklist

- [ ] Tiers and 2–3 branching questions render from content tables (no hardcoded questions)
- [ ] Each question has an ℹ️ tooltip explaining why the variable matters
- [ ] Answering advances the tier; progress reflects depth; resume restores state
- [ ] Controller is pure + unit-tested; `MAX_DEPTH = 2` defined
- [ ] Verified at 390px (bottom sheet) and 1440px (inline card); no overflow; tooltips accessible
- [ ] Catalog rows are public-read (RLS T4), session answers only in `stage_state`

## Implementation notes (built)

- **Generated gate (signed-in sessions):** `generate-gate` Edge Function (`supabase/functions/generate-gate/`) uses the LLM (`LLM_API_KEY`/`LLM_MODEL`, same OpenAI-compatible adapter as sentiment) to read the prompt + parsed intent and return the missing high-impact questions grouped by clarification type. Strict JSON + zod contract (`gate.ts`): ≤2 groups, ≤2 questions per group; `target` maps each answer to a `constraint` (maxPrice/minRating/maxDriveMinutes/availableBy) or `preference` field so the client applies answers deterministically (`src/features/stage-gate/gateAnswers.ts`) — the LLM supplies structure, never logic.
- **Activation surface:** the gate renders only for signed-in sessions (`/research?session=` — Continue/Refine/Run again from history). Guests stay fully client-side per the guest-first/local rule and use the deterministic fallback; generation failure degrades to the same fallback.
- **Grouped stage gates:** `GroupSheet.tsx` renders one clarification group per step (desktop inline card, mobile bottom sheet), progress dots count groups, Fast Track is available every step. The generated gate + answers persist in `stage_state` (`generatedGate` + `answers`) so resume restores it without regenerating.
- **Intent-aware fallback (`fallback.ts`):** guests/failure path asks a single question only when the prompt has not pinned the objective; otherwise the gate completes immediately and the run form collects the remaining inputs (budget, availability).
- **Run form (`ResearchRun.tsx`):** objective renders as a confirm chip (Edit reveals the select) instead of a fresh question; a budget input appears for value/cost objectives with no price; the query is built by the pure `buildSearchQuery()` helper in `src/lib/research-intent.ts` (no duplicated availability/country, no shop hints in the raw query).
- **Intent parsing (`research-intent.ts`):** country/location tokens are stripped from the word-slug (no more `tent-available-purchase`); object keyword maps (`tent|camping`→`tents`, etc.) give clean domains; guest session `title` is the user's topic; the settled objective is persisted in `stage_state` and consumed by synthesis.
- **Objective-aware synthesis (`engine.ts`):** `SynthesisSource.objective` drives `SCORE_WEIGHTS` + price-band preference (value/cost up-weights price and favors low band; quality up-weights sentiment; closest up-weights proximity). Report title comes from the topic, not the domain slug.

## Follow-ups

- `05-anti-rabbit-hole` enforces `MAX_DEPTH` in the UI and adds Fast Track.
- `04-scraping` consumes the finalized `stage_state` (narrowed query + tier) for the candidate pull.
- Deploy `generate-gate` (needs `LLM_API_KEY`/`LLM_MODEL` secrets, same as `scrape-and-analyze`) and let signed-in users start fresh research sessions in the cloud so the generated gate covers the primary flow, not just resumed history.
- Scrape adapters should consume gate-derived `intent.preferences` (occupancy, season, …) to narrow Overpass tags / Tavily queries.
