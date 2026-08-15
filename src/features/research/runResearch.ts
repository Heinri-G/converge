import { readGuestSession, saveGuestSession } from '@/lib/offline'
import { upsertAnalyses, upsertCandidates, type CandidateRowReference } from '@/lib/db'
import type { ResearchTier, ScrapeRequest, ScrapeResponse } from '@/lib/types'
import { runScrapeAndAnalyze } from './api'

export type ResearchPhase = 'geocoding' | 'scraping' | 'filtering' | 'analyzing' | 'complete'

interface RunResearchOptions {
  input: ScrapeRequest
  sessionId?: string
  onPhase?: (phase: ResearchPhase) => void
}

function analysisForGuest(result: ScrapeResponse): unknown[] {
  return Object.entries(result.analysis)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null)
    .map(([candidateId, analysis]) => ({ candidateId, ...analysis }))
}

async function persistRemoteResults(sessionId: string, result: ScrapeResponse) {
  const references = await upsertCandidates(sessionId, result.candidates)
  const referencesByUrl = new Map(references.map((reference) => [reference.source_url, reference]))
  const analysisRows: Array<{
    candidate_id: string
    analysis: NonNullable<ScrapeResponse['analysis'][string]>
  }> = []

  for (const candidate of result.candidates) {
    const analysis = result.analysis[candidate.id]
    const reference = referencesByUrl.get(candidate.sourceUrl)
    if (analysis && reference) analysisRows.push({ candidate_id: reference.id, analysis })
  }

  await upsertAnalyses(analysisRows)
}

async function persistGuestResults(result: ScrapeResponse, tier: ResearchTier) {
  const current = await readGuestSession()
  if (!current) return

  await saveGuestSession({
    ...current,
    candidates: result.candidates,
    analysis: analysisForGuest(result),
    tier,
  })
}

export async function runResearch({ input, sessionId, onPhase }: RunResearchOptions) {
  onPhase?.('geocoding')
  onPhase?.('scraping')
  const result = await runScrapeAndAnalyze(input)

  onPhase?.('filtering')
  if (sessionId) await persistRemoteResults(sessionId, result)
  else await persistGuestResults(result, input.tier)

  onPhase?.('analyzing')
  onPhase?.('complete')
  return result
}

export type { CandidateRowReference }
