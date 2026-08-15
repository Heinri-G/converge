import type { DomainBranch, GateQuestion, GateState } from '@/lib/types'
import type { ResearchIntent } from '@/lib/research-intent'

interface FallbackGate {
  branches: DomainBranch[]
  question: GateQuestion
  state: GateState
}

export function createFallbackGate(intent: ResearchIntent): FallbackGate {
  const rootId = `fallback-${intent.domain}-root`
  const balancedId = `fallback-${intent.domain}-balanced`
  const budgetId = `fallback-${intent.domain}-budget`
  const specialistId = `fallback-${intent.domain}-specialist`
  const objectiveLabel = {
    best_overall: 'the most balanced fit',
    best_value: 'the strongest value for money',
    lowest_cost: 'the lowest total cost',
    closest: 'the least travel or effort',
    highest_quality: 'the highest quality',
    lowest_risk: 'the fewest recurring problems',
  }[intent.objective]

  const branches: DomainBranch[] = [
    {
      id: rootId,
      parentId: null,
      domainSlug: intent.domain,
      slug: 'essential',
      tier: 'capsule',
      label: 'Essential',
      description: 'A focused starting point with the fewest unnecessary tradeoffs.',
      ordering: 0,
    },
    {
      id: balancedId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'balanced',
      tier: 'entry_espresso',
      label: 'Balanced',
      description: 'A practical middle path between cost, quality, and effort.',
      ordering: 1,
    },
    {
      id: budgetId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'budget',
      tier: 'manual_filter',
      label: 'Budget',
      description: 'A tighter option set that protects the stated budget first.',
      ordering: 2,
    },
    {
      id: specialistId,
      parentId: rootId,
      domainSlug: intent.domain,
      slug: 'specialist',
      tier: 'prosumer',
      label: 'Specialist',
      description: 'A deeper option set for cases where performance matters most.',
      ordering: 3,
    },
  ]

  const question: GateQuestion = {
    id: `fallback-${intent.domain}-question`,
    branchId: rootId,
    prompt: `When tradeoffs appear, should we protect ${objectiveLabel}?`,
    tooltip:
      'This preference shapes the shortlist; hard constraints such as price and drive time remain non-negotiable.',
    answerType: 'single',
    options: [
      { value: budgetId, label: 'Protect the constraint first' },
      { value: balancedId, label: 'Keep the tradeoff balanced' },
      { value: specialistId, label: 'Prioritize the strongest outcome' },
    ],
    weight: 1,
    ordering: 0,
  }

  return {
    branches,
    question,
    state: { domainSlug: intent.domain, branchPath: [rootId], answers: {} },
  }
}
