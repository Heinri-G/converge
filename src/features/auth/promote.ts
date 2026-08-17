import type { User } from '@supabase/supabase-js'
import { clearGuestSession, readGuestSession } from '../../lib/offline'
import {
  createSession,
  saveReport,
  upsertAnalyses,
  upsertCandidates,
  type CandidateRowReference,
} from '../../lib/db'
import { synthesize } from '../synthesis/engine'
import { isResearchObjective } from '../../lib/research-intent'
import type {
  AnalysisDraft,
  CandidateDraft,
  ResearchSession,
  ResearchTier,
} from '../../lib/types'

interface GuestAnalysisItem {
  candidateId: string
  sentimentScore: number
  pros: string[]
  cons: string[]
  defects: string[]
  sourceSummary: string
  model: string
}

function isCandidateDraft(value: unknown): value is CandidateDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CandidateDraft>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.sourceUrl === 'string'
  )
}

function isGuestAnalysisItem(value: unknown): value is GuestAnalysisItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<GuestAnalysisItem>
  return (
    typeof item.candidateId === 'string' &&
    typeof item.sentimentScore === 'number' &&
    Array.isArray(item.pros)
  )
}

function formatTitle(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function promoteGuestSession(user: User): Promise<ResearchSession | null> {
  const guest = await readGuestSession()
  if (!guest) return null
  const session = await createSession(user.id, guest.session)

  const candidates = (guest.candidates ?? []).filter(isCandidateDraft)
  try {
    if (candidates.length > 0) {
      const references: CandidateRowReference[] = await upsertCandidates(session.id, candidates)
      const refsByUrl = new Map(references.map((reference) => [reference.source_url, reference.id]))
      const candidateAnalysis: Record<string, AnalysisDraft | null> = Object.fromEntries(
        candidates.map((candidate) => [candidate.id, null]),
      )
      const analysisRows: Array<{ candidate_id: string; analysis: AnalysisDraft }> = []

      for (const item of guest.analysis ?? []) {
        if (!isGuestAnalysisItem(item)) continue
        const guestCandidate = candidates.find((candidate) => candidate.id === item.candidateId)
        if (!guestCandidate) continue
        const dbId = refsByUrl.get(guestCandidate.sourceUrl)
        if (!dbId) continue
        const draft: AnalysisDraft = {
          sentimentScore: item.sentimentScore,
          pros: item.pros,
          cons: Array.isArray(item.cons) ? item.cons : [],
          defects: Array.isArray(item.defects) ? item.defects : [],
          sourceSummary: item.sourceSummary ?? '',
          model: item.model ?? '',
        }
        analysisRows.push({ candidate_id: dbId, analysis: draft })
        candidateAnalysis[guestCandidate.id] = draft
      }

      if (analysisRows.length > 0) await upsertAnalyses(analysisRows)

      const tier: ResearchTier =
        guest.tier ?? (isFastTracked(guest.session.stage_state) ? 'broad' : 'entry_espresso')
      const objective = isResearchObjective(guest.session.stage_state.objective)
        ? guest.session.stage_state.objective
        : undefined
      const report = synthesize(
        {
          title: guest.session.title || formatTitle(guest.session.domain_slug),
          tier,
          ...(objective ? { objective } : {}),
        },
        candidates,
        candidateAnalysis,
      )
      await saveReport(session.id, report)
    }
  } catch (adoptionError) {
    console.error('Guest adoption incomplete; guest data kept for retry.', adoptionError)
    return session
  }

  await clearGuestSession()
  return session
}

function isFastTracked(stageState: Record<string, unknown>): boolean {
  return stageState.fastTracked === true
}