import { describe, expect, it } from 'vitest'
import { deriveResearchIntent } from './research-intent'

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
})
