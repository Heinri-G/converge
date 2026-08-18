import { readGuestSession, saveGuestSession } from '@/lib/offline'
import {
  loadResearchSession,
  updateSessionStageState,
  upsertAnalyses,
  upsertCandidates,
  type CandidateRowReference,
} from '@/lib/db'
import type { ResearchTier, ScrapeRequest, ScrapeResponse } from '@/lib/types'
import { runScrapeAndAnalyze } from './api'

export type ResearchPhase = 'geocoding' | 'scraping' | 'filtering' | 'analyzing' | 'complete'

interface RunResearchOptions {
  input: ScrapeRequest
  sessionId?: string
  onPhase?: (phase: ResearchPhase) => void
  signal?: AbortSignal
}

function analysisForGuest(result: ScrapeResponse): unknown[] {
  return Object.entries(result.analysis)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null)
    .map(([candidateId, analysis]) => ({ candidateId, ...analysis }))
}

async function persistRemoteResults(sessionId: string, result: ScrapeResponse, objective: string) {
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

  const session = await loadResearchSession(sessionId)
  await updateSessionStageState(sessionId, {
    ...session.stage_state,
    objective,
  })
}

async function persistGuestResults(result: ScrapeResponse, tier: ResearchTier, objective: string) {
  const current = await readGuestSession()
  if (!current) return

  await saveGuestSession({
    ...current,
    candidates: result.candidates,
    analysis: analysisForGuest(result),
    tier,
    session: {
      ...current.session,
      stage_state: { ...current.session.stage_state, objective },
    },
  })
}

export async function runResearch({ input, sessionId, onPhase, signal }: RunResearchOptions) {
  onPhase?.('geocoding')
  const result = await runScrapeAndAnalyze(input, signal)

  onPhase?.('filtering')
  if (sessionId) await persistRemoteResults(sessionId, result, input.intent.objective)
  else await persistGuestResults(result, input.tier, input.intent.objective)

  onPhase?.('analyzing')
  onPhase?.('complete')
  return result
}

export type { CandidateRowReference }
