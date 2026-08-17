import type {
  AnalysisDraft,
  AntiPick,
  CandidateDraft,
  MatrixRow,
  RankedOption,
  ReportDraft,
  ResearchTier,
} from '@/lib/types'
import type { ResearchObjective } from '@/lib/research-intent'

export interface ScoreWeights {
  sentiment: number
  proximity: number
  coverage: number
  price: number
}

const BASE_WEIGHTS: ScoreWeights = {
  sentiment: 0.5,
  proximity: 0.2,
  coverage: 0.2,
  price: 0.1,
}

const OBJECTIVE_WEIGHTS: Record<ResearchObjective, ScoreWeights> = {
  best_overall: BASE_WEIGHTS,
  best_value: { sentiment: 0.3, proximity: 0.1, coverage: 0.2, price: 0.4 },
  lowest_cost: { sentiment: 0.3, proximity: 0.1, coverage: 0.2, price: 0.4 },
  highest_quality: { sentiment: 0.65, proximity: 0.05, coverage: 0.25, price: 0.05 },
  closest: { sentiment: 0.3, proximity: 0.6, coverage: 0.1, price: 0 },
  lowest_risk: BASE_WEIGHTS,
}

const PRICE_BAND_THRESHOLDS = { low: 300, high: 800 } as const
type PriceBandScore = Record<'low' | 'mid' | 'high', number>
const DEFAULT_PRICE_SCORE: PriceBandScore = { low: 0.5, mid: 1, high: 0.5 }
const VALUE_PRICE_SCORE: PriceBandScore = { low: 1, mid: 0.6, high: 0.2 }
const PRICE_NEUTRAL_SCORE = 0.5
const OBJECTIVE_PRICE_SCORE: Record<ResearchObjective, PriceBandScore> = {
  best_overall: DEFAULT_PRICE_SCORE,
  best_value: VALUE_PRICE_SCORE,
  lowest_cost: VALUE_PRICE_SCORE,
  highest_quality: DEFAULT_PRICE_SCORE,
  closest: DEFAULT_PRICE_SCORE,
  lowest_risk: DEFAULT_PRICE_SCORE,
}
const EVIDENCE_TARGET = 6
const PROXIMITY_CAP_MINUTES = 60
const PROXIMITY_NEUTRAL = 0.5
const TOP_3_COUNT = 3
const DEFECTS_THRESHOLD = 2
const OVERHYPED_MIN_SENTIMENT = 0.4
const OVERHYPED_MIN_RATING = 4
const OVERHYPED_MIN_CONS = 3

export interface SynthesisSource {
  title: string
  tier: ResearchTier
  objective?: ResearchObjective
}

export function sentiment01(sentimentScore: number): number {
  return (sentimentScore + 1) / 2
}

export function priceBand(price: number | null): MatrixRow['priceBand'] {
  if (price === null) return null
  if (price < PRICE_BAND_THRESHOLDS.low) return 'low'
  if (price > PRICE_BAND_THRESHOLDS.high) return 'high'
  return 'mid'
}

export function proximityScore(driveMinutes: number | null): number {
  if (driveMinutes === null) return PROXIMITY_NEUTRAL
  return Math.max(0, 1 - Math.min(driveMinutes, PROXIMITY_CAP_MINUTES) / PROXIMITY_CAP_MINUTES)
}

function priceScoreFor(objective: ResearchObjective, band: MatrixRow['priceBand']): number {
  if (band === null) return PRICE_NEUTRAL_SCORE
  const table = OBJECTIVE_PRICE_SCORE[objective] ?? DEFAULT_PRICE_SCORE
  return table[band]
}

export function coverageScore(analysis: AnalysisDraft): number {
  const evidence = analysis.pros.length + analysis.cons.length + analysis.defects.length
  return Math.min(1, evidence / EVIDENCE_TARGET)
}

export function rankScore(
  candidate: CandidateDraft,
  analysis: AnalysisDraft | null,
  objective: ResearchObjective = 'best_overall',
): number | null {
  if (!analysis) return null
  const weights = OBJECTIVE_WEIGHTS[objective] ?? BASE_WEIGHTS
  return (
    weights.sentiment * sentiment01(analysis.sentimentScore) +
    weights.proximity * proximityScore(candidate.geo.driveMinutes ?? null) +
    weights.coverage * coverageScore(analysis) +
    weights.price * priceScoreFor(objective, priceBand(candidate.price))
  )
}

function strongestReason(
  row: MatrixRow,
  analysis: AnalysisDraft,
  objective: ResearchObjective,
): string {
  const weights = OBJECTIVE_WEIGHTS[objective] ?? BASE_WEIGHTS
  const dimensions = [
    {
      score: weights.sentiment * sentiment01(analysis.sentimentScore),
      text: `strongest sentiment (${analysis.sentimentScore.toFixed(1)} on a -1..1 scale)`,
    },
    {
      score: weights.proximity * proximityScore(row.driveMinutes),
      text:
        row.driveMinutes === null
          ? 'balanced proximity'
          : `closest option (${row.driveMinutes} min away)`,
    },
    {
      score: weights.coverage * coverageScore(analysis),
      text: `deepest consensus (${analysis.pros.length + analysis.cons.length + analysis.defects.length} evidence points)`,
    },
    {
      score: weights.price * priceScoreFor(objective, row.priceBand),
      text:
        row.priceBand === null
          ? 'neutral price position'
          : `preferred price band (${row.priceBand})`,
    },
  ]
  return dimensions.reduce((best, current) => (current.score > best.score ? current : best)).text
}

function buildTop3(
  matrix: MatrixRow[],
  analysis: Record<string, AnalysisDraft | null>,
  antiPickIds: Set<string>,
  objective: ResearchObjective,
): RankedOption[] {
  const ranked = matrix
    .filter((row): row is MatrixRow & { compositeScore: number } => row.compositeScore !== null)
    .sort(
      (a, b) =>
        b.compositeScore - a.compositeScore ||
        (b.rating ?? -1) - (a.rating ?? -1) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, TOP_3_COUNT)

  return ranked.map((row, index) => {
    const candidateAnalysis = analysis[row.candidateId]!
    const tension = antiPickIds.has(row.candidateId)
    return {
      candidateId: row.candidateId,
      name: row.name,
      rank: index + 1,
      reason: `${strongestReason(row, candidateAnalysis, objective)}${
        tension ? ' — also flags a risk below; weigh it before committing.' : ''
      }`,
    }
  })
}

function buildAntiPicks(
  candidates: CandidateDraft[],
  analysis: Record<string, AnalysisDraft | null>,
): AntiPick[] {
  const picks: AntiPick[] = []

  for (const candidate of candidates) {
    const candidateAnalysis = analysis[candidate.id]
    if (!candidateAnalysis) continue

    if (candidateAnalysis.defects.length >= DEFECTS_THRESHOLD) {
      picks.push({
        candidateId: candidate.id,
        name: candidate.name,
        redFlag: 'defects',
        reason: `Recurring defects: ${candidateAnalysis.defects.join('; ')}`,
      })
      continue
    }

    if (
      candidate.rating !== null &&
      candidate.rating >= OVERHYPED_MIN_RATING &&
      candidateAnalysis.sentimentScore > OVERHYPED_MIN_SENTIMENT &&
      candidateAnalysis.cons.length >= OVERHYPED_MIN_CONS
    ) {
      const topCons = candidateAnalysis.cons.slice(0, 2).join('; ')
      picks.push({
        candidateId: candidate.id,
        name: candidate.name,
        redFlag: 'overhyped',
        reason: `Glowing score, but ${candidateAnalysis.cons.length} material cons remain: ${topCons}`,
      })
    }
  }

  return picks
}

export function synthesize(
  source: SynthesisSource,
  candidates: CandidateDraft[],
  analysis: Record<string, AnalysisDraft | null>,
): ReportDraft {
  const objective = source.objective ?? 'best_overall'
  const matrix: MatrixRow[] = candidates.map((candidate) => {
    const candidateAnalysis = analysis[candidate.id] ?? null
    return {
      candidateId: candidate.id,
      name: candidate.name,
      sourceUrl: candidate.sourceUrl,
      tier: source.tier,
      driveMinutes: candidate.geo.driveMinutes ?? null,
      rating: candidate.rating,
      sentimentScore: candidateAnalysis ? candidateAnalysis.sentimentScore : null,
      priceBand: priceBand(candidate.price),
      prosCount: candidateAnalysis?.pros.length ?? 0,
      consCount: candidateAnalysis?.cons.length ?? 0,
      defectsCount: candidateAnalysis?.defects.length ?? 0,
      compositeScore: rankScore(candidate, candidateAnalysis, objective),
    }
  })

  const antiPicksRaw = buildAntiPicks(candidates, analysis)
  const antiPickIds = new Set(antiPicksRaw.map((pick) => pick.candidateId))
  const top3 = buildTop3(matrix, analysis, antiPickIds, objective)
  const top3Ids = new Set(top3.map((option) => option.candidateId))
  const antiPicks = antiPicksRaw.filter((pick) => !top3Ids.has(pick.candidateId))

  return { title: source.title, matrix, top_3: top3, anti_picks: antiPicks }
}