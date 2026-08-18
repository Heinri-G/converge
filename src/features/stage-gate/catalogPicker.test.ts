import { describe, expect, it } from 'vitest'
import type { DomainAttribute } from '@/lib/types'
import { createCatalogGate, MAX_ATTRIBUTE_QUESTIONS } from './catalogPicker'

const occupancy: DomainAttribute = {
  id: 'a1',
  slug: 'occupancy',
  label: 'Occupancy',
  prompt: 'How many people should it sleep?',
  tooltip: 'Occupancy drives floor area and weight.',
  answerType: 'single',
  options: [{ value: '1-2', label: '1–2 people' }],
  keywords: ['person', 'people'],
  priority: 1,
  ordering: 0,
  target: { kind: 'preference', field: 'occupancy', valueType: 'string' },
}

const waterproofing: DomainAttribute = {
  id: 'a2',
  slug: 'waterproofing',
  label: 'Waterproofing',
  prompt: 'Does it need to keep you dry in heavy rain?',
  tooltip: 'Hydrostatic-head rating is the honest number.',
  answerType: 'single',
  options: [{ value: 'heavy', label: 'Yes — heavy rain' }],
  keywords: ['waterproof', 'water resistant'],
  priority: 2,
  ordering: 1,
  target: { kind: 'preference', field: 'waterproofing', valueType: 'string' },
}

const blackout: DomainAttribute = {
  id: 'a3',
  slug: 'blackout',
  label: 'Blackout',
  prompt: 'Does morning light bother you?',
  tooltip: 'Blackout fabric blocks early light.',
  answerType: 'boolean',
  options: [],
  keywords: ['blackout', 'dark'],
  priority: 3,
  ordering: 2,
  target: { kind: 'preference', field: 'blackout', valueType: 'boolean' },
}

const packability: DomainAttribute = {
  id: 'a4',
  slug: 'packability',
  label: 'Packability',
  prompt: 'How much packed size are you OK with?',
  tooltip: 'Packed volume decides hiking vs car camping.',
  answerType: 'single',
  options: [{ value: 'backpack', label: 'Backpack-friendly' }],
  keywords: ['lightweight', 'packable'],
  priority: 4,
  ordering: 3,
  target: { kind: 'preference', field: 'packability', valueType: 'string' },
}

const ALL = [occupancy, waterproofing, blackout, packability]

describe('catalogPicker', () => {
  it('picks up to 3 unanswered attributes in priority order', () => {
    const gate = createCatalogGate(ALL, new Set())

    expect(gate.groups).toHaveLength(1)
    expect(gate.groups[0]!.questions.map((q) => q.id)).toEqual([
      'attr-occupancy',
      'attr-waterproofing',
      'attr-blackout',
    ])
    expect(gate.groups[0]!.questions).toHaveLength(MAX_ATTRIBUTE_QUESTIONS)
  })

  it('skips attributes already answered in the prompt', () => {
    const gate = createCatalogGate(ALL, new Set(['occupancy', 'blackout']))

    const ids = gate.groups[0]!.questions.map((q) => q.id)
    expect(ids).toEqual(['attr-waterproofing', 'attr-packability'])
  })

  it('returns no groups when everything is already answered', () => {
    const gate = createCatalogGate(ALL, new Set(ALL.map((a) => a.slug)))

    expect(gate.groups).toHaveLength(0)
  })

  it('preserves the attribute target for deterministic answer mapping', () => {
    const gate = createCatalogGate([waterproofing, blackout], new Set())

    expect(gate.groups[0]!.questions[0]!.target).toEqual(waterproofing.target)
    expect(gate.groups[0]!.questions[1]!.target).toEqual(blackout.target)
    expect(gate.groups[0]!.questions[1]!.answerType).toBe('boolean')
  })
})