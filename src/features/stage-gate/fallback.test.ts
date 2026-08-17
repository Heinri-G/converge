import { describe, expect, it } from 'vitest'
import { deriveResearchIntent } from '@/lib/research-intent'
import { createFallbackGate, fallbackObjectiveFromBranch } from './fallback'

describe('fallback gate', () => {
  it('skips the gate when the objective is already pinned by the prompt', () => {
    const intent = deriveResearchIntent('best value tent in the netherlands')

    expect(intent.objective).toBe('best_value')
    expect(createFallbackGate(intent).question).toBeNull()
  })

  it('asks the prioritization question when no objective is expressed', () => {
    const intent = deriveResearchIntent('I want a tent for family trips')

    expect(intent.objective).toBe('best_overall')
    const fallback = createFallbackGate(intent)
    expect(fallback.question).not.toBeNull()
    expect(fallback.question!.options).toHaveLength(3)
  })

  it('still asks the priority question when a budget is pinned but the objective is not', () => {
    const intent = deriveResearchIntent('tent under 200')

    expect(intent.objective).toBe('best_overall')
    expect(intent.hardConstraints.maxPrice).toBe(200)
    expect(createFallbackGate(intent).question).not.toBeNull()
  })

  it('maps the prioritization branch to a concrete objective', () => {
    expect(fallbackObjectiveFromBranch('fallback-x-budget')).toEqual({ objective: 'lowest_cost' })
    expect(fallbackObjectiveFromBranch('fallback-x-specialist')).toEqual({
      objective: 'highest_quality',
    })
    expect(fallbackObjectiveFromBranch('fallback-x-balanced')).toEqual({ objective: 'best_overall' })
  })
})