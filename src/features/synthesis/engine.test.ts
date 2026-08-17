import { describe, expect, it } from 'vitest'
import type { AnalysisDraft, CandidateDraft } from '@/lib/types'
import { rankScore, sentiment01, synthesize } from './engine'

function candidate(id: string, overrides: Partial<CandidateDraft> = {}): CandidateDraft {
  return {
    id,
    source: 'fixture',
    sourceUrl: `https://example.com/${id}`,
    name: id,
    geo: { lat: 0, lng: 0, driveMinutes: 20 },
    rating: 4.2,
    price: 400,
    currency: null,
    objectiveScore: null,
    hardConstraintStatus: 'pass',
    data: {},
    ...overrides,
  }
}

function analysis(id: string, overrides: Partial<AnalysisDraft> = {}): AnalysisDraft {
  return {
    sentimentScore: 0.5,
    pros: ['p1'],
    cons: ['c1'],
    defects: [],
    sourceSummary: `fixture summary for ${id}`,
    model: 'fixture',
    ...overrides,
  }
}

const source = { title: 'Espresso under $600', tier: 'entry_espresso' as const }

describe('synthesis engine', () => {
  it('is deterministic: identical input produces identical output', () => {
    const candidates = [candidate('a'), candidate('b'), candidate('c')]
    const analyses = {
      a: analysis('a'),
      b: analysis('b', { sentimentScore: 0.8 }),
      c: analysis('c', { sentimentScore: 0.1 }),
    }

    const first = synthesize(source, candidates, analyses)
    const second = synthesize(source, candidates, analyses)

    expect(second).toEqual(first)
  })

  it('ranks by composite score, then rating, then name', () => {
    const candidates = [
      candidate('zeta', { rating: 4.0 }),
      candidate('alpha', { rating: 4.5 }),
      candidate('beta', { rating: 4.5 }),
    ]
    const analyses = {
      zeta: analysis('zeta', { sentimentScore: 0.5 }),
      alpha: analysis('alpha', { sentimentScore: 0.5 }),
      beta: analysis('beta', { sentimentScore: 0.5 }),
    }

    const { top_3 } = synthesize(source, candidates, analyses)

    expect(top_3.map((option) => option.name)).toEqual(['alpha', 'beta', 'zeta'])
    expect(top_3.map((option) => option.rank)).toEqual([1, 2, 3])
  })

  it('keeps null-analysis candidates in the matrix but excludes them from top 3', () => {
    const candidates = [
      candidate('good', { rating: 4.8 }),
      candidate('unanalyzed'),
      candidate('mid', { rating: 3.5 }),
    ]
    const analyses = {
      good: analysis('good', { sentimentScore: 0.9 }),
      unanalyzed: null,
      mid: analysis('mid', { sentimentScore: 0.2 }),
    }

    const { matrix, top_3 } = synthesize(source, candidates, analyses)
    const row = matrix.find((entry) => entry.candidateId === 'unanalyzed')!

    expect(row.sentimentScore).toBeNull()
    expect(row.compositeScore).toBeNull()
    expect(top_3.find((option) => option.candidateId === 'unanalyzed')).toBeUndefined()
    expect(top_3).toHaveLength(2)
  })

  it('fires the defects anti-pick rule with reasons from analysis', () => {
    const candidates = [
      candidate('a', { rating: 4.8, geo: { lat: 0, lng: 0, driveMinutes: 5 } }),
      candidate('b', { rating: 4.8, geo: { lat: 0, lng: 0, driveMinutes: 10 } }),
      candidate('c', { rating: 4.7, geo: { lat: 0, lng: 0, driveMinutes: 15 } }),
      candidate('broken', { rating: 4.5 }),
    ]
    const analyses = {
      a: analysis('a', { sentimentScore: 0.95, pros: ['p1', 'p2', 'p3'] }),
      b: analysis('b', { sentimentScore: 0.95, pros: ['p1', 'p2', 'p3'] }),
      c: analysis('c', { sentimentScore: 0.9, pros: ['p1', 'p2', 'p3'] }),
      broken: analysis('broken', {
        sentimentScore: 0.2,
        defects: ['temperature drifts', 'service unclear'],
      }),
    }

    const { anti_picks } = synthesize(source, candidates, analyses)

    expect(anti_picks).toHaveLength(1)
    expect(anti_picks[0]).toMatchObject({
      candidateId: 'broken',
      redFlag: 'defects',
    })
    expect(anti_picks[0]!.reason).toContain('temperature drifts')
  })

  it('fires the overhyped rule for glowing scores with material cons', () => {
    const candidates = [
      candidate('a', { rating: 4.8, geo: { lat: 0, lng: 0, driveMinutes: 5 } }),
      candidate('b', { rating: 4.8, geo: { lat: 0, lng: 0, driveMinutes: 10 } }),
      candidate('c', { rating: 4.7, geo: { lat: 0, lng: 0, driveMinutes: 15 } }),
      candidate('overhyped', { rating: 4.6 }),
    ]
    const analyses = {
      a: analysis('a', {
        sentimentScore: 0.95,
        pros: ['p1', 'p2', 'p3'],
        cons: ['heavy'],
      }),
      b: analysis('b', {
        sentimentScore: 0.95,
        pros: ['p1', 'p2', 'p3'],
        cons: ['heavy'],
      }),
      c: analysis('c', {
        sentimentScore: 0.9,
        pros: ['p1', 'p2', 'p3'],
        cons: ['heavy'],
      }),
      overhyped: analysis('overhyped', {
        sentimentScore: 0.8,
        cons: ['noisy pump', 'small tank', 'wobbly base'],
      }),
    }

    const { anti_picks } = synthesize(source, candidates, analyses)

    expect(anti_picks).toHaveLength(1)
    expect(anti_picks[0]).toMatchObject({ candidateId: 'overhyped', redFlag: 'overhyped' })
    expect(anti_picks[0]!.reason).toContain('noisy pump')
  })

  it('resolves a candidate in both lists to top 3 with a tension note', () => {
    const candidates = [
      candidate('strong', { rating: 4.9 }),
      candidate('weak', { rating: 2.0 }),
      candidate('mid', { rating: 3.0 }),
    ]
    const analyses = {
      strong: analysis('strong', {
        sentimentScore: 0.9,
        defects: ['loud', 'service unclear'],
      }),
      weak: analysis('weak', { sentimentScore: -0.5 }),
      mid: analysis('mid', { sentimentScore: 0.0 }),
    }

    const { top_3, anti_picks } = synthesize(source, candidates, analyses)

    expect(top_3[0]!.candidateId).toBe('strong')
    expect(top_3[0]!.reason).toContain('risk below')
    expect(anti_picks.find((pick) => pick.candidateId === 'strong')).toBeUndefined()
  })

  it('normalizes sentiment to 0..1 for scoring', () => {
    expect(sentiment01(-1)).toBe(0)
    expect(sentiment01(0)).toBe(0.5)
    expect(sentiment01(1)).toBe(1)
  })

  it('produces composite scores in the 0..1 band', () => {
    const candidates = [candidate('a')]
    const analyses = { a: analysis('a', { sentimentScore: 1, pros: ['x', 'y', 'z'] }) }

    const score = rankScore(candidates[0]!, analyses.a)
    const { matrix } = synthesize(source, candidates, analyses)

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
    expect(matrix[0]!.compositeScore).toBe(score)
  })

  it('favors cheaper options for a value objective', () => {
    const candidates = [
      candidate('cheap', { price: 150, rating: 3.8, geo: { lat: 0, lng: 0 } }),
      candidate('premium', { price: 950, rating: 4.9, geo: { lat: 0, lng: 0 } }),
    ]
    const analyses = {
      cheap: analysis('cheap', { sentimentScore: 0.3, pros: ['p1', 'p2'], cons: ['c1'] }),
      premium: analysis('premium', { sentimentScore: 0.9, pros: ['p1', 'p2'], cons: ['c1'] }),
    }

    const valueScore = rankScore(candidates[0]!, analyses.cheap, 'best_value')!
    const defaultScore = rankScore(candidates[0]!, analyses.cheap)!

    expect(valueScore).toBeGreaterThan(rankScore(candidates[1]!, analyses.premium, 'best_value')!)
    expect(defaultScore).toBeLessThan(rankScore(candidates[1]!, analyses.premium)!)
  })

  it('lets the objective steer the top-3 ordering', () => {
    const candidates = [
      candidate('cheap', { price: 150, rating: 3.8 }),
      candidate('premium', { price: 950, rating: 4.9 }),
      candidate('mid', { price: 450, rating: 4.2 }),
    ]
    const analyses = {
      cheap: analysis('cheap', { sentimentScore: 0.3 }),
      premium: analysis('premium', { sentimentScore: 0.9 }),
      mid: analysis('mid', { sentimentScore: 0.6 }),
    }

    const valueReport = synthesize(
      { ...source, objective: 'best_value' },
      candidates,
      analyses,
    )
    const qualityReport = synthesize(
      { ...source, objective: 'highest_quality' },
      candidates,
      analyses,
    )

    expect(valueReport.top_3[0]!.candidateId).toBe('cheap')
    expect(qualityReport.top_3[0]!.candidateId).toBe('premium')
  })
})