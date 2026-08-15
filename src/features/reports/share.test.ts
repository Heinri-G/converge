import { describe, expect, it } from 'vitest'
import { sha256Hex } from './share'

describe('share token hashing', () => {
  it('produces a lowercase sha256 hex digest', async () => {
    const digest = await sha256Hex('hello')

    expect(digest).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('never returns the raw token value', async () => {
    const token = crypto.randomUUID()
    const digest = await sha256Hex(token)

    expect(digest).not.toContain(token)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })
})