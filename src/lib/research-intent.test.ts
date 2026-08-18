import { describe, expect, it } from 'vitest'
import {
  answeredAttributeValues,
  buildSearchQuery,
  deriveResearchIntent,
  detectAnsweredAttributeSlugs,
  specAttributesFromPreferences,
} from './research-intent'
import type { DomainAttribute } from './types'

const TENT_ATTRIBUTES: DomainAttribute[] = [
  {
    id: 'a1',
    slug: 'occupancy',
    label: 'Occupancy',
    prompt: 'How many people should it sleep?',
    tooltip: 'Occupancy drives floor area and weight.',
    answerType: 'single',
    options: [],
    keywords: ['person', 'people', 'sleeper', 'berth', 'man tent', '2 person', '4 person'],
    priority: 1,
    ordering: 0,
    target: { kind: 'preference', field: 'occupancy', valueType: 'string' },
  },
  {
    id: 'a2',
    slug: 'waterproofing',
    label: 'Waterproofing',
    prompt: 'Does it need to keep you dry in heavy rain?',
    tooltip: 'Hydrostatic-head rating is the honest number.',
    answerType: 'single',
    options: [],
    keywords: ['waterproof', 'water resistant', 'hh', 'hydrostatic', 'weatherproof'],
    priority: 2,
    ordering: 1,
    target: { kind: 'preference', field: 'waterproofing', valueType: 'string' },
  },
  {
    id: 'a3',
    slug: 'blackout',
    label: 'Blackout',
    prompt: 'Does morning light bother you?',
    tooltip: 'Blackout fabric blocks early light.',
    answerType: 'boolean',
    options: [],
    keywords: ['blackout', 'dark'],
    priority: 4,
    ordering: 3,
    target: { kind: 'preference', field: 'blackout', valueType: 'boolean' },
  },
  {
    id: 'a4',
    slug: 'packability',
    label: 'Packability',
    prompt: 'How much packed size are you OK with?',
    tooltip: 'Packed volume decides hiking vs car camping.',
    answerType: 'single',
    options: [],
    keywords: ['lightweight', 'packable', 'backpack'],
    priority: 5,
    ordering: 4,
    target: { kind: 'preference', field: 'packability', valueType: 'string' },
  },
]

describe('attribute detection', () => {
  it('detects attributes already stated in the prompt', () => {
    const slugs = detectAnsweredAttributeSlugs('best 4 person waterproof tent', TENT_ATTRIBUTES)

    expect(slugs.has('occupancy')).toBe(true)
    expect(slugs.has('waterproofing')).toBe(true)
    expect(slugs.has('blackout')).toBe(false)
  })

  it('does not false-positive on substring matches', () => {
    const slugs = detectAnsweredAttributeSlugs('a tent for personal use', TENT_ATTRIBUTES)

    expect(slugs.has('occupancy')).toBe(false)
  })

  it('extracts values with numeric captures for sized attributes', () => {
    const values = answeredAttributeValues('best 4 person waterproof tent', TENT_ATTRIBUTES)

    expect(values.occupancy).toBe('4 person')
    expect(values.waterproofing).toBe('waterproof')
  })

  it('resolves boolean attributes to true when mentioned', () => {
    const values = answeredAttributeValues('a blackout tent', TENT_ATTRIBUTES)

    expect(values.blackout).toBe(true)
  })

  it('returns an empty set when nothing is stated', () => {
    const slugs = detectAnsweredAttributeSlugs('recommend a good tent', TENT_ATTRIBUTES)

    expect(slugs.size).toBe(0)
  })

  it('derives the spec-extraction schema from settled preferences', () => {
    const specs = specAttributesFromPreferences({
      context: 'product',
      locallyOrderable: true,
      shippingCountry: 'NL',
      budgetFocused: false,
      occupancy: '4 person',
      blackout: true,
    })

    expect(specs).toEqual([
      { slug: 'occupancy', label: 'occupancy', valueType: 'string' },
      { slug: 'blackout', label: 'blackout', valueType: 'boolean' },
    ])
  })
})

describe('research intent parsing', () => {
  it('keeps a drive-time constraint separate from price', () => {
    const intent = deriveResearchIntent(
      'Find golf courses within 30 min of Nijkerk, green fee under €60',
    )

    expect(intent.domain).toBe('golf')
    expect(intent.objective).toBe('best_overall')
    expect(intent.hardConstraints).toMatchObject({
      maxDriveMinutes: 30,
      maxPrice: 60,
      currency: 'EUR',
    })
    expect(intent.location?.address).toBe('Nijkerk')
  })

  it('turns value language into an objective without inventing a hard budget', () => {
    const intent = deriveResearchIntent('Best value for money on a budget')

    expect(intent.objective).toBe('best_value')
    expect(intent.hardConstraints.maxPrice).toBeUndefined()
    expect(intent.preferences.budgetFocused).toBe(true)
    expect(intent.location).toBeUndefined()
  })

  it('maps coffee equipment terms to the coffee-espresso domain, not a word slug', () => {
    const intent = deriveResearchIntent('best value coffee tampers in the netherlands')

    expect(intent.domain).toBe('coffee-espresso')
    expect(intent.objective).toBe('best_value')
  })

  it('treats product queries as product context with local availability on by default', () => {
    const intent = deriveResearchIntent('best value coffee tampers in the netherlands')

    expect(intent.preferences.context).toBe('product')
    expect(intent.preferences.locallyOrderable).toBe(true)
    expect(intent.preferences.shippingCountry).toBe('NL')
    expect(intent.location).toBeUndefined()
    expect(intent.hardConstraints.maxDriveMinutes).toBeUndefined()
  })

  it('keeps drive time for place queries and parses hour limits', () => {
    const intent = deriveResearchIntent('golf course no more than 2 hours from Amsterdam')

    expect(intent.preferences.context).toBe('place')
    expect(intent.hardConstraints.maxDriveMinutes).toBe(120)
    expect(intent.location?.address).toBe('Amsterdam')
  })

  it('uses the browser locale as the shipping default for products', () => {
    const intent = deriveResearchIntent('best cheap espresso machine', undefined, {
      locale: 'nl-NL',
    })
    expect(intent.preferences.context).toBe('product')
    expect(intent.preferences.shippingCountry).toBe('NL')
  })

  it('honors an explicit drive-time mention on a product query', () => {
    const intent = deriveResearchIntent('coffee tamper within 30 minutes of Utrecht')

    expect(intent.preferences.context).toBe('place')
    expect(intent.hardConstraints.maxDriveMinutes).toBe(30)
    expect(intent.location?.address).toBe('Utrecht')
  })

  it('does not mistake a marketplace mention for a location', () => {
    const intent = deriveResearchIntent('espresso machine from amazon')

    expect(intent.preferences.context).toBe('product')
    expect(intent.location).toBeUndefined()
  })

  it('maps tents to a clean domain slug without the country word', () => {
    const intent = deriveResearchIntent('best value tent available to purchase in the netherlands')

    expect(intent.domain).toBe('tents')
    expect(intent.objective).toBe('best_value')
    expect(intent.preferences.shippingCountry).toBe('NL')
    expect(intent.hardConstraints.maxPrice).toBeUndefined()
  })

  it('builds a query without duplicating availability or country, and no shop hints', () => {
    const intent = deriveResearchIntent('best value tent available to purchase in the netherlands')

    const query = buildSearchQuery(
      intent.topic,
      'tents',
      intent.objective,
      {
        context: 'product',
        locallyOrderable: true,
        shippingCountry: 'NL',
        preferences: intent.preferences,
      },
    )

    expect(query).toBe('best value tent available to purchase in the netherlands')
    expect(query).not.toMatch(/bol\.com/)
    expect(query).not.toMatch(/available to order in Netherlands/)
  })

  it('appends the availability clause only when the prompt lacks it', () => {
    const intent = deriveResearchIntent('best 4-season tent')

    const query = buildSearchQuery(
      intent.topic,
      'tents',
      intent.objective,
      {
        context: 'product',
        locallyOrderable: true,
        shippingCountry: 'NL',
        preferences: intent.preferences,
      },
    )

    expect(query).toContain('available to order in Netherlands')
    expect(query).not.toMatch(/bol\.com/)
  })

  it('appends gate-derived preference keywords to the query', () => {
    const intent = deriveResearchIntent('tent')

    const query = buildSearchQuery(
      intent.topic,
      'tents',
      intent.objective,
      {
        context: 'product',
        locallyOrderable: false,
        preferences: { ...intent.preferences, season: '3-season', occupancy: '4 people' },
      },
    )

    expect(query).toContain('3-season')
    expect(query).toContain('4 people')
  })
})
