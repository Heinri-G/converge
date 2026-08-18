import { describe, expect, it } from 'vitest'
import { buildUserPrompt, sanitizeGate } from './gate'

const catalogGate = {
  groups: [
    {
      id: 'group-spec',
      title: 'Setup',
      rationale: 'A few decisions that steer the search.',
      questions: [
        {
          id: 'q-occupancy',
          prompt: 'How many people should it sleep?',
          tooltip: 'Occupancy drives floor area and weight.',
          answerType: 'single',
          options: [
            { value: '1-2', label: '1–2 people' },
            { value: '3-4', label: '3–4 people' },
          ],
          target: { kind: 'preference', field: 'occupancy', valueType: 'string' },
        },
        {
          id: 'q-blackout',
          prompt: 'Does morning light bother you?',
          tooltip: 'Blackout fabric blocks early light.',
          answerType: 'boolean',
          options: [],
          target: { kind: 'preference', field: 'blackout', valueType: 'boolean' },
        },
      ],
    },
  ],
}

describe('generate-gate contract', () => {
  it('accepts a gate built from catalog attributes', () => {
    expect(sanitizeGate(catalogGate)).toEqual(catalogGate)
  })

  it('drops questions with unknown constraint fields', () => {
    const gate = sanitizeGate({
      groups: [
        {
          id: 'g',
          title: 'T',
          rationale: 'R',
          questions: [
            catalogGate.groups[0].questions[0],
            {
              id: 'q-bad',
              prompt: 'How loud?',
              tooltip: 'Noise matters.',
              answerType: 'single',
              options: [{ value: 'quiet', label: 'Quiet' }],
              target: { kind: 'constraint', field: 'noiseDb', valueType: 'number' },
            },
          ],
        },
      ],
    })

    expect(gate.groups[0].questions).toHaveLength(1)
    expect(gate.groups[0].questions[0].id).toBe('q-occupancy')
  })

  it('drops preference questions targeting reserved fields', () => {
    const gate = sanitizeGate({
      groups: [
        {
          id: 'g',
          title: 'T',
          rationale: 'R',
          questions: [
            {
              id: 'q-reserved',
              prompt: 'Region?',
              tooltip: 'Shipping region.',
              answerType: 'single',
              options: [{ value: 'us', label: 'US' }],
              target: { kind: 'preference', field: 'shippingCountry', valueType: 'string' },
            },
          ],
        },
      ],
    })

    expect(gate.groups).toHaveLength(0)
  })

  it('rejects malformed payloads', () => {
    expect(() => sanitizeGate({ groups: 'nope' })).toThrow('invalid_shape')
    expect(() => sanitizeGate(null)).toThrow('invalid_shape')
    expect(() => sanitizeGate({})).toThrow('invalid_shape')
  })

  it('includes the catalog and answered slugs in the user prompt', () => {
    const prompt = buildUserPrompt({
      topic: 'best 4 person tent',
      domainSlug: 'tents',
      intent: { objective: 'best_overall', hardConstraints: {}, preferences: {} },
      catalog: [
        {
          slug: 'occupancy',
          label: 'Occupancy',
          prompt: 'How many people?',
          tooltip: 'Occupancy matters.',
          answerType: 'single',
          options: [{ value: '3-4', label: '3–4 people' }],
          target: { kind: 'preference', field: 'occupancy', valueType: 'string' },
        },
      ],
      answered: ['occupancy'],
    })

    expect(prompt).toContain('Available attribute catalog')
    expect(prompt).toContain('occupancy')
    expect(prompt).toContain('Already answered')
    expect(prompt).toContain('occupancy')
  })

  it('omits catalog sections when absent', () => {
    const prompt = buildUserPrompt({
      topic: 'best tent',
      domainSlug: 'tents',
      intent: { objective: 'best_overall', hardConstraints: {}, preferences: {} },
    })

    expect(prompt).not.toContain('Available attribute catalog')
    expect(prompt).not.toContain('Already answered')
  })
})