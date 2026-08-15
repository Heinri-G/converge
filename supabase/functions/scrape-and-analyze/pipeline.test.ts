import { describe, expect, it } from 'vitest'
import {
  parseSentiment,
  runPipeline,
  validateRequestBody,
  type PipelineDependencies,
} from './pipeline'

const request = validateRequestBody({
  query: 'coffee espresso',
  domainSlug: 'coffee-espresso',
  intent: {
    topic: 'coffee espresso',
    domain: 'coffee-espresso',
    objective: 'best_overall',
    hardConstraints: {},
    preferences: {},
  },
  geo: { lat: 52.1, lng: 5.1 },
  radiusMinutes: 30,
  tier: 'entry_espresso',
  maxResults: 10,
})

describe('scrape-and-analyze pipeline', () => {
  it('rejects malformed bounded input', () => {
    expect(() => validateRequestBody({ query: 'x' })).toThrow('query_length_invalid')
    expect(() =>
      validateRequestBody({
        query: 'coffee',
        domainSlug: 'coffee-espresso',
        intent: {
          topic: 'coffee',
          domain: 'coffee-espresso',
          objective: 'best_overall',
          hardConstraints: {},
          preferences: {},
        },
        geo: { address: 'Home' },
        radiusMinutes: 121,
        tier: 'broad',
        maxResults: 10,
      }),
    ).toThrow('radius_minutes_invalid')
  })

  it('filters by drive time, deduplicates URLs, and keeps the result cap', async () => {
    const dependencies: PipelineDependencies = {
      geo: {
        async resolve() {
          return { lat: 52.1, lng: 5.1 }
        },
        async driveMinutes(_from, to) {
          return to.lat === 52.2 ? 45 : 12
        },
      },
      sources: [
        {
          id: 'fake',
          async fetch() {
            return [
              {
                sourceUrl: 'https://example.com/a',
                name: 'Near A',
                geo: { lat: 52.1, lng: 5.1 },
                text: 'owners report a sturdy build',
              },
              {
                sourceUrl: 'https://example.com/a',
                name: 'Duplicate A',
                geo: { lat: 52.1, lng: 5.1 },
              },
              { sourceUrl: 'https://example.com/far', name: 'Far', geo: { lat: 52.2, lng: 5.1 } },
            ]
          },
        },
      ],
      sentiment: {
        async analyze() {
          return {
            sentimentScore: 0.6,
            pros: ['sturdy'],
            cons: [],
            defects: [],
            summary: 'Positive consensus',
          }
        },
      },
      model: 'fake-model',
    }

    const result = await runPipeline(request, dependencies)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.id).toBe('candidate-1')
    expect(result.candidates[0]?.geo.driveMinutes).toBe(12)
    expect(result.analysis['candidate-1']?.pros).toEqual(['sturdy'])
  })

  it('degrades malformed sentiment to a null candidate analysis', () => {
    expect(parseSentiment('{"sentimentScore":"bad"}', 'fake-model')).toBeNull()
  })

  it('supports non-geographic research without routing fields', async () => {
    const requestWithoutGeo = validateRequestBody({
      query: 'best value for money on a budget',
      domainSlug: 'general-research',
      intent: {
        topic: 'best value for money on a budget',
        domain: 'general-research',
        objective: 'best_value',
        hardConstraints: {},
        preferences: { budgetFocused: true },
      },
      tier: 'broad',
      maxResults: 5,
    })
    const result = await runPipeline(requestWithoutGeo, {
      geo: {
        async resolve() {
          return { lat: 0, lng: 0 }
        },
        async driveMinutes() {
          return 0
        },
      },
      sources: [
        {
          id: 'fake',
          async fetch() {
            return [{ sourceUrl: 'https://example.com/value', name: 'Value option' }]
          },
        },
      ],
      sentiment: {
        async analyze() {
          return { sentimentScore: 0, pros: [], cons: [], defects: [], summary: 'Neutral' }
        },
      },
      model: 'fake-model',
    })

    expect(result.candidates[0]?.geo.driveMinutes).toBeUndefined()
  })

  it('rejects candidates above a hard price ceiling before analysis', async () => {
    const priceRequest = validateRequestBody({
      query: 'golf under 30 euro',
      domainSlug: 'golf',
      intent: {
        topic: 'golf under 30 euro',
        domain: 'golf',
        objective: 'best_value',
        hardConstraints: { maxPrice: 30, currency: 'EUR' },
        preferences: { budgetFocused: true },
      },
      tier: 'broad',
      maxResults: 10,
    })
    const result = await runPipeline(priceRequest, {
      geo: {
        async resolve() {
          return { lat: 0, lng: 0 }
        },
        async driveMinutes() {
          return 0
        },
      },
      sources: [
        {
          id: 'fake',
          async fetch() {
            return [
              {
                sourceUrl: 'https://example.com/cheap',
                name: 'Affordable',
                price: 20,
                currency: 'EUR',
              },
              {
                sourceUrl: 'https://example.com/expensive',
                name: 'Too expensive',
                price: 45,
                currency: 'EUR',
              },
            ]
          },
        },
      ],
      sentiment: {
        async analyze() {
          return { sentimentScore: 0.3, pros: [], cons: [], defects: [], summary: 'Usable' }
        },
      },
      model: 'fake-model',
    })

    expect(result.candidates.map((candidate) => candidate.name)).toEqual(['Affordable'])
    expect(result.candidates[0]?.objectiveScore).not.toBeNull()
  })
})
