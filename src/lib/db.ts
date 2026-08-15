import { supabase } from './supabase'
import type {
  AnalysisDraft,
  CandidateDraft,
  ReportDraft,
  ResearchSession,
  SessionDraft,
  SessionResolution,
} from './types'

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

export async function updateSessionResolution(
  sessionId: string,
  resolution: SessionResolution,
  stageState: Record<string, unknown>,
): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .update({ resolution, stage_state: stageState })
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

export async function saveReport(
  sessionId: string,
  report: ReportDraft,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('reports')
    .upsert(
      {
        session_id: sessionId,
        title: report.title,
        matrix: report.matrix,
        top_3: report.top_3,
        anti_picks: report.anti_picks,
      },
      { onConflict: 'session_id' },
    )
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function loadReport(sessionId: string): Promise<ReportDraft | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('title, matrix, top_3, anti_picks')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    title: data.title ?? '',
    matrix: (data.matrix ?? []) as ReportDraft['matrix'],
    top_3: (data.top_3 ?? []) as ReportDraft['top_3'],
    anti_picks: (data.anti_picks ?? []) as ReportDraft['anti_picks'],
  }
}

export async function loadResearchSession(sessionId: string): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) throw error
  return data
}

interface CandidateRow {
  id: string
  source: string
  source_url: string
  name: string
  geo: CandidateDraft['geo']
  rating: number | null
  data: Record<string, unknown>
}

function mapCandidateRow(row: CandidateRow): CandidateDraft {
  const data = row.data ?? {}
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    name: row.name,
    geo: row.geo,
    rating: row.rating,
    price: typeof data.price === 'number' ? data.price : null,
    currency: typeof data.currency === 'string' ? data.currency : null,
    objectiveScore: typeof data.objectiveScore === 'number' ? data.objectiveScore : null,
    hardConstraintStatus:
      data.hardConstraintStatus === 'pass' || data.hardConstraintStatus === 'unknown'
        ? data.hardConstraintStatus
        : 'unknown',
    data,
  }
}

export async function loadSessionCandidates(sessionId: string): Promise<CandidateDraft[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, source, source_url, name, geo, rating, data')
    .eq('session_id', sessionId)
    .order('created_at')

  if (error) throw error
  return ((data ?? []) as CandidateRow[]).map(mapCandidateRow)
}

interface AnalysisRow {
  candidate_id: string
  sentiment_score: number
  pros: string[]
  cons: string[]
  defects: string[]
  source_summary: string
  model: string
}

export async function loadSessionAnalyses(
  sessionId: string,
): Promise<Record<string, AnalysisDraft | null>> {
  const { data, error } = await supabase
    .from('analysis')
    .select(
      'candidate_id, sentiment_score, pros, cons, defects, source_summary, model, candidates!inner(session_id)',
    )
    .eq('candidates.session_id', sessionId)

  if (error) throw error

  const byId: Record<string, AnalysisDraft> = {}
  for (const row of (data ?? []) as AnalysisRow[]) {
    byId[row.candidate_id] = {
      sentimentScore: row.sentiment_score,
      pros: row.pros ?? [],
      cons: row.cons ?? [],
      defects: row.defects ?? [],
      sourceSummary: row.source_summary ?? '',
      model: row.model ?? '',
    }
  }
  return byId
}
