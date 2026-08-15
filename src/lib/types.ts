import type { ResearchIntent } from './research-intent'

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

export type ResearchTier = 'broad' | Tier

export interface GeoPoint {
  lat: number
  lng: number
}

export interface ResearchGeo {
  address?: string
  lat?: number
  lng?: number
}

export interface ScrapeRequest {
  query: string
  domainSlug: string
  intent: ResearchIntent
  geo?: ResearchGeo
  radiusMinutes?: number
  tier: ResearchTier
  maxResults: number
}

export interface CandidateGeo extends GeoPoint {
  driveMinutes?: number
  address?: string
}

export interface CandidateDraft {
  id: string
  source: string
  sourceUrl: string
  name: string
  geo: CandidateGeo
  rating: number | null
  price: number | null
  currency: string | null
  objectiveScore: number | null
  hardConstraintStatus: 'pass' | 'unknown'
  data: Record<string, unknown>
}

export interface AnalysisDraft {
  sentimentScore: number
  pros: string[]
  cons: string[]
  defects: string[]
  sourceSummary: string
  model: string
}

export interface ScrapeResponse {
  candidates: CandidateDraft[]
  analysis: Record<string, AnalysisDraft | null>
}
