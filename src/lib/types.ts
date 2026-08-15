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

export type Tier = 'capsule' | 'manual_filter' | 'entry_espresso' | 'prosumer'

export interface DomainBranch {
  id: string
  parentId: string | null
  domainSlug: string
  slug: string
  tier: Tier
  label: string
  description: string
  ordering: number
}

export interface GateOption {
  value: string
  label: string
}

export interface GateQuestion {
  id: string
  branchId: string
  prompt: string
  tooltip: string
  answerType: 'single' | 'boolean'
  options: GateOption[]
  weight: number
  ordering: number
}

export type GateAnswer = string | boolean

export interface GateState extends Record<string, unknown> {
  domainSlug: string
  branchPath: string[]
  answers: Record<string, GateAnswer>
}
