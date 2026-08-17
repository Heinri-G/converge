import type { DomainBranch, GateQuestion, GateState } from '@/lib/types'
import type { ResearchIntent } from '@/lib/research-intent'

interface FallbackGate {
  branches: DomainBranch[]
  question: GateQuestion | null
  state: GateState
}

function buildBranches(intent: ResearchIntent): DomainBranch[] {
  const rootId = `fallback-${intent.domain}-root`
  const balancedId = `fallback-${intent.domain}-balanced`
  const budgetId = `fallback-${intent.domain}-budget`
  const specialistId = `fallback-${intent.domain}-specialist`

  return [
    {
      id: rootId,
      parentId: null,
      domainSlug: intent.domain,
      slug: 'essential',
      tier: 'capsule',
      label: 'Quick & simple',
      description: 'A no-fuss starting point with the fewest tradeoffs.',
      ordering: 0,
    },
    {
      id: balancedId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'balanced',
      tier: 'entry_espresso',
      label: 'Everyday balance',
      description: 'A practical middle path between cost, quality, and effort.',
      ordering: 1,
    },
    {
      id: budgetId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'budget',
      tier: 'manual_filter',
      label: 'Budget first',
      description: 'A tighter option set that protects the stated budget first.',
      ordering: 2,
    },
    {
      id: specialistId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'specialist',
      tier: 'prosumer',
      label: 'Best performance',
      description: 'For when quality or performance matters most.',
      ordering: 3,
    },
  ]
}

function buildPrioritizationQuestion(intent: ResearchIntent): GateQuestion {
  const rootId = `fallback-${intent.domain}-root`
  const balancedId = `fallback-${intent.domain}-balanced`
  const budgetId = `fallback-${intent.domain}-budget`
  const specialistId = `fallback-${intent.domain}-specialist`

  return {
    id: `fallback-${intent.domain}-question`,
    branchId: rootId,
    prompt: 'If two options both fit, what tips the decision?',
    tooltip: 'This shapes how we rank the shortlist — price, effort, or performance.',
    answerType: 'single',
    options: [
      { value: budgetId, label: 'The lowest price wins' },
      { value: balancedId, label: 'The best everyday balance' },
      { value: specialistId, label: 'The best performance wins' },
    ],
    weight: 1,
    ordering: 0,
  }
}

/**
 * Deterministic fallback gate used for guests and when gate generation fails.
 * Asks a single question only when the prompt has not already pinned the
 * objective; otherwise it completes immediately and the run form collects the
 * remaining missing inputs (budget, availability).
 */
export function createFallbackGate(intent: ResearchIntent): FallbackGate {
  const rootId = `fallback-${intent.domain}-root`
  const branches = buildBranches(intent)

  const objectivePinned = intent.objective !== 'best_overall'
  const question = objectivePinned ? null : buildPrioritizationQuestion(intent)

  const state: GateState = { domainSlug: intent.domain, branchPath: [rootId], answers: {} }

  return { branches, question, state }
}

/** Maps a fallback prioritization answer to a concrete objective for the run form. */
export function fallbackObjectiveFromBranch(
  value: string,
): { objective?: ResearchIntent['objective'] } {
  if (value.endsWith('-budget')) return { objective: 'lowest_cost' }
  if (value.endsWith('-specialist')) return { objective: 'highest_quality' }
  if (value.endsWith('-balanced')) return { objective: 'best_overall' }
  return {}
}