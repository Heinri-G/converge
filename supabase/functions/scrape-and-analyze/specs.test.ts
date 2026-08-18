import { describe, expect, it } from 'vitest'
import { parseSpecs } from './specs'

const ATTRIBUTES = [
  { slug: 'occupancy', label: 'Occupancy', valueType: 'string' as const },
  { slug: 'waterproofing', label: 'Waterproofing', valueType: 'string' as const },
  { slug: 'blackout', label: 'Blackout', valueType: 'boolean' as const },
  { slug: 'weight', label: 'Weight', valueType: 'number' as const },
]

describe('specs extraction', () => {
  it('strips undeclared keys and coerces declared values', () => {
    const specs = parseSpecs(
      {
        specs: {
          occupancy: '4',
          blackout: true,
          weight: 3.2,
          invented: 'nope',
        },
      },
      ATTRIBUTES,
    )

    expect(specs).toEqual({ occupancy: '4', blackout: true, weight: 3.2 })
  })

  it('coerces numeric and boolean strings', () => {
    const specs = parseSpecs(
      { specs: { weight: '3.2', blackout: 'yes' } },
      ATTRIBUTES,
    )

    expect(specs).toEqual({ weight: 3.2, blackout: true })
  })

  it('omits missing or invalid values', () => {
    const specs = parseSpecs({ specs: { occupancy: '' } }, ATTRIBUTES)

    expect(specs).toBeNull()
  })

  it('returns null for malformed payloads', () => {
    expect(parseSpecs(null, ATTRIBUTES)).toBeNull()
    expect(parseSpecs({ specs: 'nope' }, ATTRIBUTES)).toBeNull()
    expect(parseSpecs({ specs: { weight: 'abc' } }, ATTRIBUTES)).toBeNull()
  })
})