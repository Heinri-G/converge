import { supabase } from './supabase'
import type {
  AnalysisDraft,
  CandidateDraft,
  ReportDraft,
  ResearchSession,
  SessionDraft,
  SessionResolution,
  SessionSummary,
  SharedReportPayload,
  ShareDraft,
  ShareRow,
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

export async function loadReport(sessionId: string): Promise<(ReportDraft & { reportId: string }) | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, title, matrix, top_3, anti_picks')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    reportId: data.id,
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

export async function listSessions(): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('research_sessions')
    .select('id, domain_slug, title, resolution, updated_at, stage_state')
    .order('updated_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as SessionSummary[]).map((row) => ({
    ...row,
    stage_state: (row.stage_state ?? {}) as Record<string, unknown>,
  }))
}

export async function createClonedSession(
  priorSessionId: string,
  resolution: SessionResolution,
): Promise<ResearchSession> {
  const prior = await loadResearchSession(priorSessionId)
  const { data, error } = await supabase
    .from('research_sessions')
    .insert({
      owner_id: prior.owner_id,
      domain_slug: prior.domain_slug,
      title: prior.title,
      resolution,
      stage_state: prior.stage_state,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function insertShare(draft: ShareDraft): Promise<ShareRow> {
  const { data, error } = await supabase
    .from('shares')
    .insert({
      report_id: draft.reportId,
      share_type: draft.shareType,
      token_hash: draft.tokenHash ?? null,
      granted_to: draft.grantedTo ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as ShareRow
}

export async function listShares(reportId: string): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from('shares')
    .select('id, report_id, share_type, granted_to, created_at, revoked_at')
    .eq('report_id', reportId)

  if (error) throw error
  return (data ?? []) as ShareRow[]
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)

  if (error) throw error
}

export async function resolveUserByEmail(email: string): Promise<string> {
  const { data, error } = await supabase.rpc('resolve_user_id_by_email', { p_email: email })
  if (error) throw error
  if (!data) throw new Error('No account matches that email.')
  return data as string
}

interface SharedReportRow {
  id: string
  session_id: string
  title: string
  matrix: unknown
  top_3: unknown
  anti_picks: unknown
  created_at: string
}

export async function getSharedReport(token: string): Promise<SharedReportPayload> {
  const { data, error } = await supabase.rpc('get_shared_report', { p_token: token })

  if (error) {
    if (error.message.includes('share_not_found')) {
      throw new Error('This report is no longer available.')
    }
    throw error
  }

  const payload = data as {
    report: SharedReportRow
    candidates: CandidateRow[]
    analysis: AnalysisRow[]
  }

  const analysisById: Record<string, AnalysisDraft | null> = {}
  for (const row of payload.analysis ?? []) {
    analysisById[row.candidate_id] = {
      sentimentScore: row.sentiment_score,
      pros: row.pros ?? [],
      cons: row.cons ?? [],
      defects: row.defects ?? [],
      sourceSummary: row.source_summary ?? '',
      model: row.model ?? '',
    }
  }

  return {
    report: {
      title: payload.report?.title ?? '',
      matrix: (payload.report?.matrix ?? []) as ReportDraft['matrix'],
      top_3: (payload.report?.top_3 ?? []) as ReportDraft['top_3'],
      anti_picks: (payload.report?.anti_picks ?? []) as ReportDraft['anti_picks'],
    },
    candidates: (payload.candidates ?? []).map(mapCandidateRow),
    analysis: analysisById,
  }
}
