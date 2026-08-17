import { describe, expect, it } from 'vitest'
import { buildSearchQuery, deriveResearchIntent } from './research-intent'

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
