# 11 — Research Flow UX: Plain Language + Streamlined Journey

> **Pillar:** Cross-cutting UX copy + flow · **Order:** 11 · **Depends on:** 03, 04, 05, 06
> **Goal:** make the research flow intuitive — plain, user-facing language for every
> surface, and a compressed journey: **prompt → quick questions → "Ready to search"
> → shortlist → report**. Keep the Miura visual world (creases ∧∨×, gold, spec
> cards, mountain/valley semantics) intact; change language and flow, not theme.

## Why

Users hit engineering-process language that leaks from the architecture ("tier
sequence", "pull", "adaptive map", "Stage gate 1", "deploy", "pipeline",
"geocoding", "result cap") and a redundant second form ("Now shape the pull")
that re-asks what the prompt already said. For non-seeded domains the single
fallback question ("When tradeoffs appear, should we protect X?") is abstract and
feels unrelated to what the user typed.

## Decisions locked in (user-confirmed 2026-08-16)

1. **Plain process language, keep visuals.** The fold/crease/gold world stays;
   process copy becomes plain and job-focused.
2. **Single "Ready to search" step.** Replaces the "Now shape the pull" form:
   understood setup shown as editable chips + optional address + one gold CTA.
   The "Result cap" dropdown is removed from the UX (server keeps the 10 default).
3. **Concrete intent-based questions everywhere**, including the seeded coffee
   gate (questions reworded in migration `0004`, text only — option `value`s are
   stable branch ids and must not change).

## Changes

### Flow consolidation (structure)

- `src/features/stage-gate/GateWizard.tsx`
  - When `initialPrompt` implies a **seeded** domain, auto-enter the gate
    (skip the "choose a domain" chooser). Keep a reworded chooser only for the
    empty `/research` (no prompt) path.
  - Remove the "Tier sequence" chip row (internal taxonomy, not user value).
  - Reword header/copy (see below).
- `src/features/research/ResearchRun.tsx`
  - Convert the form into a **"Ready to search"** confirmation card:
    - Understood setup as editable chips (objective / budget / drive-time radius).
    - Optional address field; radius dropdown only when geo is on.
    - Remove the "Result cap" select.
    - Primary CTA renamed **"Find my options"**.
  - Reword result/empty/error copy.
- `src/features/stage-gate/fallback.ts`
  - Replace the single abstract question with concrete intent-derived questions
    (budget strictness when a price was stated; otherwise "If two options fit,
    what tips the decision?"). Options still map to existing branch ids.

### Copy/terminology (all surfaces)

| Surface | Current | Proposed |
|---|---|---|
| Home primary CTA | Deploy research | Start research |
| Home secondary CTA | Fast Track | Skip the questions |
| Home hero | Converge folds a question into a shortlist worth deciding on. | Describe what you're choosing — get a shortlist worth deciding on. |
| Home section label | Crease field | Reading the marks (∧ strengths / ∨ risks / × avoid) |
| Gate kicker | Stage gate 1 | A few quick questions |
| Gate title | Fold the question before you chase the answer. | Answer a couple of quick questions — get a focused shortlist. |
| Gate sub | Start with the variable that changes the decision. Converge will keep the path short and leave the rabbit hole behind. | Each question targets what changes the outcome most. No rabbit holes. |
| Chooser title | Choose a domain to map. | What are you comparing? |
| Chooser sub | The catalog supplies the tiers and questions. Nothing is baked into this screen. | (drop the implementation-explaining line) |
| Chooser CTA | Use a {domain} map / Open the adaptive map | Use {domain} / Open {domain} |
| Sheet/card title | Adaptive mapping | A couple of quick questions |
| Question progress | Fold depth · {branch} | Question {n} of {max} |
| Sheet description | One answer folds the research toward a useful tier. | Your answers steer the search toward the right options. |
| Fast Track row | Fast Track — good enough, show top options | Skip the questions — show me top options now |
| Fast Track tooltip | Skips the remaining questions and jumps to the broad domain pull. | Searches more broadly using just your prompt. |
| Run kicker | Map ready | Your search |
| Run title | Now shape the pull. | Ready to search. |
| Run sub | Hard constraints stay hard. The objective guides the tradeoffs between the options that remain. | Check what Converge understood — you can adjust anything before the search starts. |
| Run CTA | Run research | Find my options |
| Progress titles | The pull stopped / was cancelled / is ready | The search stopped / was cancelled / finished |
| Progress sub | The pipeline keeps the search bounded while it works through the source material. | Searching listings, reviews, and forums, focused on your setup. |
| Progress phases | Geocoding starting point / Collecting source listings / Filtering by drive-time radius / Extracting sentiment and defects | Finding places near you / Collecting listings & reviews / Checking drive times / Summarizing what owners say |
| Cancel action | Cancel pull | Stop |
| Results title | {n} options survived the constraints. | {n} options matched your setup. |
| Results empty | No candidates came back. Check the provider adapters and try the pull again. | Nothing came back — try a broader prompt or loosen the radius. |
| Constraint unknown | Constraint data is incomplete; this option cannot be treated as a confirmed match. | We couldn't confirm this option meets your constraint — treat it as unverified. |
| Report chip | {tier} pull | Broad search (or plain focus label) |
| History empty | Run a gate and pull once, and every finished report lands here. | Finish a search and the report lands here. |
| History error | A fresh pull could not be started. | A new search could not be started. |
| History badge | Fast Track | Quick results |
| Top-3 empty | … missing for this pull. | … missing for this search. |
| Anti-Picks empty | No options to avoid in this pull. | No options to avoid this time. |
| Shared report chip | {tier} pull | Broad search |
| Demo | mirrors the above | update to match |

### Seeded coffee gate — reworded (migration `0004`, text only)

**Branch labels/descriptions** (display only; internal `tier` keys unchanged):
- Capsule → **Quick & simple** · "A no-fuss setup that fits small spaces and busy mornings."
- Manual Filter → **Compact & manual** · "A hands-on routine that stays out of the way."
- Entry Espresso → **Everyday espresso** · "A repeatable espresso routine with a gentle learning curve."
- Prosumer → **Enthusiast setup** · "A dedicated counter setup for tuning the whole ritual."

**Questions:**
- Q1: "How much counter space can this setup claim?" options → "It has to pack away each use" / "It can keep a small corner" / "It can own the counter"; tooltip → "Footprint is the first real tradeoff — something that must pack away can't be a bulky counter fixture."
- Q2: "How involved do you want the daily routine to be?" options → "Keep it simple and repeatable" / "I want to dial it in each time"; tooltip → "More control usually means more steps every brew — worth knowing before you commit."
- Q3: "What matters most in the next machine?" options → "Consistency, every single time" / "Room to experiment and improve"; tooltip → "Speed, consistency, and room to tinker pull in different directions — pick the one that steers the search."

> Keep the `value` (branch id) of every option exactly as-is — the content model
> maps answers to branches by id.

### Docs

- This file. `PRODUCT.md`/`ARCHITECTURE.md`/impl specs keep the internal model
  as developer truth (no terminology churn there).

## Verification

1. `npm run lint && npm run typecheck && npm run test && npm run build`
2. Playwright at **390px** and **1440px**: prompt → auto-gate (seeded domain) →
   answer 1–2 → "Ready to search" → Find my options → progress → results →
   report. Fast Track ("Skip the questions") path too.
3. Unknown-domain prompt (e.g. "laptop") → concrete fallback question → run.
4. Grep `src/` for leaked jargon: `pull|pipeline|geocod|tier sequence|stage gate|adaptive map` — no user-facing matches.
5. Run the impeccable detector once over changed files.

## Acceptance checklist

- [ ] No "pull/pipeline/tier sequence/stage gate/adaptive map/deploy" in user-facing copy
- [ ] Seeded domain auto-enters the gate; no chooser detour
- [ ] "Ready to search" shows editable setup summary + one CTA; no Result cap
- [ ] Fallback gate asks concrete intent-derived questions
- [ ] Coffee gate questions reworded with stable option ids
- [ ] Verified at 390px and 1440px; lint/typecheck/test/build green
