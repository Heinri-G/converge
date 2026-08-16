import type { DomainBranch, GateQuestion, GateState } from '@/lib/types'
import type { ResearchIntent } from '@/lib/research-intent'

interface FallbackGate {
  branches: DomainBranch[]
  question: GateQuestion
  state: GateState
}

function currencySymbol(currency?: string): string {
  if (currency === 'EUR') return '€'
  if (currency === 'GBP') return '£'
  return '$'
}

export function createFallbackGate(intent: ResearchIntent): FallbackGate {
  const rootId = `fallback-${intent.domain}-root`
  const balancedId = `fallback-${intent.domain}-balanced`
  const budgetId = `fallback-${intent.domain}-budget`
  const specialistId = `fallback-${intent.domain}-specialist`

  const branches: DomainBranch[] = [
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

  const maxPrice = intent.hardConstraints.maxPrice
  const symbol = currencySymbol(intent.hardConstraints.currency)

  const question: GateQuestion =
    maxPrice !== undefined
      ? {
          id: `fallback-${intent.domain}-budget-question`,
          branchId: rootId,
          prompt: `You said under ${symbol}${maxPrice} — how firm is that?`,
          tooltip:
            'If the number is a hard limit, we filter for it strictly. If it can bend, a clearly better option can win.',
          answerType: 'single',
          options: [
            { value: budgetId, label: `Under ${symbol}${maxPrice} is a hard limit` },
            { value: balancedId, label: 'A little over is fine if it is clearly better' },
            { value: specialistId, label: 'Quality matters more than the number' },
          ],
          weight: 1,
          ordering: 0,
        }
      : {
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

  return {
    branches,
    question,
    state: { domainSlug: intent.domain, branchPath: [rootId], answers: {} },
  }
}
