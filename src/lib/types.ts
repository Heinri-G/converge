export type SessionResolution = 'in_progress' | 'complete' | 'fast_tracked'

export interface ResearchSession {
  id: string
  owner_id: string
  domain_slug: string
  title: string
  resolution: SessionResolution
  stage_state: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SessionDraft {
  domain_slug: string
  title: string
  resolution: SessionResolution
  stage_state: Record<string, unknown>
}

export interface GuestSessionRecord {
  guestId: string
  session: SessionDraft
  candidates: unknown[]
  analysis: unknown[]
}
