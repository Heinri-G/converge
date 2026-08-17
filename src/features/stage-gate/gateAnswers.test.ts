import { describe, expect, it } from 'vitest'
import type { GeneratedGate } from '@/lib/types'
import { deriveResearchIntent } from '@/lib/research-intent'
import { applyGateAnswers, parseGeneratedGate } from './gateAnswers'

const gate: GeneratedGate = {
  groups: [
    {
      id: 'group-budget',
      title: 'Budget & availability',
      rationale: 'A few final details before we search.',
      questions: [
        {
          id: 'q-budget',
          prompt: 'Roughly how much are you thinking?',
          tooltip: 'A ceiling keeps the shortlist realistic.',
          answerType: 'single',
          options: [
            { value: '250', label: 'Under 250' },
            { value: '500', label: '250 to 500' },
          ],
          target: { kind: 'constraint', field: 'maxPrice', valueType: 'number' },
        },
        {
          id: 'q-season',
          prompt: 'What season?',
          tooltip: 'Season changes the materials you want.',
          answerType: 'single',
          options: [
            { value: '3-season', label: '3-season' },
            { value: '4-season', label: '4-season' },
          ],
          target: { kind: 'preference', field: 'season', valueType: 'string' },
        },
      ],
    },
  ],
}

describe('gateAnswers', () => {
  it('maps numeric constraint answers onto hardConstraints', () => {
    const intent = deriveResearchIntent('best value tent in the netherlands')
    const merged = applyGateAnswers(intent, gate, { 'q-budget': '250' })

    expect(merged.hardConstraints.maxPrice).toBe(250)
    expect(merged.preferences.season).toBeUndefined()
  })

  it('maps preference answers onto preferences', () => {
    const intent = deriveResearchIntent('best value tent in the netherlands')
    const merged = applyGateAnswers(intent, gate, { 'q-season': '3-season' })

    expect(merged.preferences.season).toBe('3-season')
    expect(merged.hardConstraints.maxPrice).toBeUndefined()
  })

  it('does not clobber existing hard constraints it does not answer', () => {
    const intent = deriveResearchIntent('tent under 300 in the netherlands')
    const merged = applyGateAnswers(intent, gate, { 'q-season': '3-season' })

    expect(merged.hardConstraints.maxPrice).toBe(300)
  })

  it('ignores answers for questions that are not in the gate', () => {
    const intent = deriveResearchIntent('tent')
    const merged = applyGateAnswers(intent, gate, { 'q-unknown': 'whatever' })

    expect(merged).toEqual(intent)
  })

  it('parses a stored generated gate and rejects malformed payloads', () => {
    expect(parseGeneratedGate(gate)).toEqual(gate)
    expect(parseGeneratedGate({ groups: 'nope' })).toBeNull()
    expect(parseGeneratedGate(null)).toBeNull()
    expect(parseGeneratedGate({ groups: [{ id: 'g', title: '', rationale: '', questions: [] }] })).toBeNull()
  })
})