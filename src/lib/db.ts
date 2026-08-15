import { supabase } from './supabase'
import type { AnalysisDraft, CandidateDraft, ResearchSession, SessionDraft } from './types'

export async function createSession(
  ownerId: string,
  input: SessionDraft,
): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .insert({ owner_id: ownerId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSessionStageState(
  sessionId: string,
  stageState: Record<string, unknown>,
): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .update({ stage_state: stageState })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data
}

export interface CandidateRowReference {
  id: string
  source_url: string
}

export async function upsertCandidates(
  sessionId: string,
  candidates: CandidateDraft[],
): Promise<CandidateRowReference[]> {
  const rows = candidates.map((candidate) => ({
    session_id: sessionId,
    source: candidate.source,
    source_url: candidate.sourceUrl,
    name: candidate.name,
    geo: candidate.geo,
    rating: candidate.rating,
    data: {
      ...candidate.data,
      ...(candidate.price === null ? {} : { price: candidate.price }),
      ...(candidate.currency === null ? {} : { currency: candidate.currency }),
      ...(candidate.objectiveScore === null ? {} : { objectiveScore: candidate.objectiveScore }),
      hardConstraintStatus: candidate.hardConstraintStatus,
    },
  }))

  if (rows.length === 0) return []

  const { data, error } = await supabase
    .from('candidates')
    .upsert(rows, { onConflict: 'session_id,source_url' })
    .select('id, source_url')

  if (error) throw error
  return (data ?? []) as CandidateRowReference[]
}

export async function upsertAnalyses(
  rows: Array<{ candidate_id: string; analysis: AnalysisDraft }>,
): Promise<void> {
  if (rows.length === 0) return

  const payload = rows.map(({ candidate_id, analysis }) => ({
    candidate_id,
    sentiment_score: analysis.sentimentScore,
    pros: analysis.pros,
    cons: analysis.cons,
    defects: analysis.defects,
    source_summary: analysis.sourceSummary,
    model: analysis.model,
  }))

  const { error } = await supabase.from('analysis').upsert(payload, { onConflict: 'candidate_id' })

  if (error) throw error
}
