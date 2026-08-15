# 05 — Anti-Rabbit-Hole Controls

> **Pillar:** Anti-Rabbit-Hole Controls (2) · **Order:** 6 · **Depends on:** 03, 04
> **Goal:** enforce the hard decision-depth cap (max 2 levels) and give the user a one-click "Fast Track / Good Enough" escape that skips remaining questions and jumps straight to the top broad candidates.

References: ARCHITECTURE.md (pillar flow 2), PRODUCT.md (Anti-rabbit-hole controls, principle "keep the user in control").

## Decisions locked in

- **Depth cap is enforced in two places:** the pure controller (`03` `flow.ts` clamps `branchPath` to `MAX_DEPTH`) and the UI (never renders a third level even if seed data is deeper). A defensive guard: if a session's `stage_state.branchPath` exceeds `MAX_DEPTH`, truncate on load.
- **Fast Track / Good Enough** is one tap. It sets `research_sessions.resolution = 'fast_tracked'` and bypasses remaining gate questions straight to the **root-tier broad pull** — the `04` function call with `tier: 'broad'` and no branch narrowing.
- Full runs set `resolution = 'complete'`; in-flight sessions stay `'in_progress'`. Resume behavior depends on `resolution`:
  - `in_progress` → resume the gate at the exact unanswered question (`stage_state`).
  - `fast_tracked` → go straight to results (synthesis `06`), never back into the gate.
  - `complete` → view the report (`07`).
- Mobile-first: the Fast Track button is **always thumb-reachable** — pinned at the bottom of the question sheet on phones — and is a plain single tap with no confirmation dialog (the cost of undoing is trivial: the gate was a shortcut).

## Step 1 — Controller hard cap

In `src/features/stage-gate/flow.ts` (from `03`), make the clamp explicit and tested:

```ts
export function nextBranch(state, question, answer): GateState {
  const branchPath = isAtMaxDepth(state) ? state.branchPath : [...state.branchPath, question.branchId]
  return { ...state, branchPath, answers: { ...state.answers, [question.id]: answer } }
}
```

Tests: a seeded depth-4 path produces `branchPath.length === 2` and `isAtMaxDepth` is true; a `fast_tracked` session never re-enters the gate.

## Step 2 — Fast Track action

`src/features/stage-gate/fastTrack.ts`:

```ts
export async function fastTrack(sessionId: string, state: GateState) {
  // 1. persist resolution
  await db.updateSession(sessionId, {
    resolution: 'fast_tracked',
    stage_state: { ...state, fastTracked: true },
  })
  // 2. jump to results: invoke scrape-and-analyze with tier: 'broad'
  //    (root query for the domain, no branch narrowing) — same code path as 04
  await runResearch(sessionId, { tier: 'broad' })
  // 3. route to synthesis (06)
}
```

Behavior contract:
- Shown from the first question onward (the user may bail at any point), never only at the end.
- Tap once → immediately leaves the gate. No confirm dialog, no "are you sure" step.
- If the broad pull fails, surface a retry that re-runs `fastTrack` (idempotent: same `resolution`, upsert-style candidate insert via the `source_url` guard from `04`).

## Step 3 — UI wiring

`GateWizard.tsx`:
- Add the **Fast Track / Good Enough** button as a fixed, bottom-anchored, full-width, 48px-tall button on the question sheet at every step — thumb reach on phones. On `min-width: md` it docks at the bottom of the inline card.
- Copy: "Fast Track — good enough, show top options." The ℹ️ tooltip explains it skips the remaining questions.
- When `resolution === 'fast_tracked'` or `stage_state.fastTracked`, never render `QuestionSheet` again (guard in the wizard's initial branch).
- Progress dots on phones now read as "you can jump to results anytime."

## Step 4 — Resume hardening

`loadSession(sessionId)` returns `{ session, gateState }`:
- `in_progress` → restore the wizard at the first unanswered question.
- `fast_tracked` → route directly to results with the candidate/analysis data.
- Depth-truncate any over-deep `stage_state` on load (defensive).

## Verification

1. `vitest run src/features/stage-gate` — clamp tests + fast-track state tests.
2. Playwright at **390px**: start a gate, tap Fast Track from step 1 → lands on results (broad candidates) in one tap, no dialog; at **1440px**: same, button docks in-card.
3. Resume: an `in_progress` session returns to the exact unanswered question; a `fast_tracked` session skips the gate entirely.
4. Seed a temporary depth-4 branch → UI never renders a third level.
5. `npm run lint && npm run typecheck`; impeccable detector once.

## Acceptance checklist

- [ ] Depth never exceeds 2 (controller clamp + UI guard + load-time truncation)
- [ ] Fast Track is one tap, always available, no confirmation, and lands on top broad candidates
- [ ] `resolution` values drive resume correctly for all three states
- [ ] Verified at 390px (bottom-anchored, thumb-reachable) and 1440px
- [ ] Fast-track failures retry idempotently

## Follow-ups

- `06-synthesis` renders results for both `complete` and `fast_tracked` sessions.
- `07` surfaces the resolution badge (Fast Track / Complete) in history.
