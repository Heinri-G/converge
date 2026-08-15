export type Tier = 'capsule' | 'manual_filter' | 'entry_espresso' | 'prosumer'
export type ResearchTier = 'broad' | Tier
export type ResearchObjective =
  'best_overall' | 'best_value' | 'lowest_cost' | 'closest' | 'highest_quality' | 'lowest_risk'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface RequestBody {
  query: string
  domainSlug: string
  intent: ResearchIntent
  geo?: { address?: string; lat?: number; lng?: number }
  radiusMinutes?: number
  tier: ResearchTier
  maxResults: number
}

export interface ResearchIntent {
  topic: string
  domain: string
  objective: ResearchObjective
  hardConstraints: {
    maxPrice?: number
    currency?: string
    maxDriveMinutes?: number
    minRating?: number
    availableBy?: string
  }
  preferences: Record<string, string | number | boolean>
  location?: { address?: string; lat?: number; lng?: number }
}

export interface RawListing {
  sourceUrl: string
  name: string
  geo?: GeoPoint
  rating?: number | null
  price?: number | null
  currency?: string | null
  data?: Record<string, unknown>
  text?: string
}

export interface CandidateDraft {
  id: string
  source: string
  sourceUrl: string
  name: string
  geo: { lat?: number; lng?: number; driveMinutes?: number; address?: string }
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

export interface SourceAdapter {
  id: string
  timeoutMs?: number
  minIntervalMs?: number
  fetch(query: string, geo?: GeoPoint, radiusMinutes?: number): Promise<RawListing[]>
}

export interface GeoAdapter {
  resolve(address: string): Promise<GeoPoint>
  driveMinutes(from: GeoPoint, to: GeoPoint): Promise<number>
}

export interface SentimentAdapter {
  analyze(listing: RawListing, context: { query: string; domainSlug: string }): Promise<unknown>
}

export interface PipelineDependencies {
  geo: GeoAdapter
  sources: SourceAdapter[]
  sentiment: SentimentAdapter
  model: string
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} provider is not configured`)
    this.name = 'ProviderNotConfiguredError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTier(value: unknown): value is ResearchTier {
  return (
    value === 'broad' ||
    value === 'capsule' ||
    value === 'manual_filter' ||
    value === 'entry_espresso' ||
    value === 'prosumer'
  )
}

function isObjective(value: unknown): value is ResearchObjective {
  return (
    value === 'best_overall' ||
    value === 'best_value' ||
    value === 'lowest_cost' ||
    value === 'closest' ||
    value === 'highest_quality' ||
    value === 'lowest_risk'
  )
}

function validateIntent(value: unknown): ResearchIntent {
  if (!isRecord(value)) throw new Error('intent_must_be_object')
  if (
    typeof value.topic !== 'string' ||
    value.topic.trim().length < 2 ||
    value.topic.length > 200
  ) {
    throw new Error('intent_topic_invalid')
  }
  if (
    typeof value.domain !== 'string' ||
    value.domain.trim().length < 1 ||
    value.domain.length > 100
  ) {
    throw new Error('intent_domain_invalid')
  }
  if (!isObjective(value.objective)) throw new Error('intent_objective_invalid')
  if (!isRecord(value.hardConstraints) || !isRecord(value.preferences)) {
    throw new Error('intent_constraints_invalid')
  }

  const { maxPrice, currency, maxDriveMinutes, minRating, availableBy } = value.hardConstraints
  if (maxPrice !== undefined && (!isFiniteNumber(maxPrice) || maxPrice < 0)) {
    throw new Error('intent_price_invalid')
  }
  if (currency !== undefined && (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))) {
    throw new Error('intent_currency_invalid')
  }
  if (
    maxDriveMinutes !== undefined &&
    (!isFiniteNumber(maxDriveMinutes) ||
      !Number.isInteger(maxDriveMinutes) ||
      maxDriveMinutes < 1 ||
      maxDriveMinutes > 120)
  ) {
    throw new Error('intent_drive_minutes_invalid')
  }
  if (minRating !== undefined && (!isFiniteNumber(minRating) || minRating < 0 || minRating > 5)) {
    throw new Error('intent_rating_invalid')
  }
  if (availableBy !== undefined && (typeof availableBy !== 'string' || availableBy.length > 100)) {
    throw new Error('intent_availability_invalid')
  }

  return value as unknown as ResearchIntent
}

export function validateRequestBody(input: unknown): RequestBody {
  if (!isRecord(input)) throw new Error('request_body_must_be_object')

  const query = typeof input.query === 'string' ? input.query.trim() : ''
  if (query.length < 2 || query.length > 200) throw new Error('query_length_invalid')

  const domainSlug = typeof input.domainSlug === 'string' ? input.domainSlug.trim() : ''
  if (domainSlug.length < 1 || domainSlug.length > 100) {
    throw new Error('domain_slug_invalid')
  }

  const intent = validateIntent(input.intent)

  const requestedRadius = input.radiusMinutes ?? intent.hardConstraints.maxDriveMinutes
  if (
    requestedRadius !== undefined &&
    (!isFiniteNumber(requestedRadius) ||
      !Number.isInteger(requestedRadius) ||
      requestedRadius < 1 ||
      requestedRadius > 120)
  ) {
    throw new Error('radius_minutes_invalid')
  }

  const maxResults = input.maxResults
  if (
    !isFiniteNumber(maxResults) ||
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > 50
  ) {
    throw new Error('max_results_invalid')
  }

  if (!isTier(input.tier)) throw new Error('tier_invalid')

  const geoInput = input.geo ?? intent.location
  if (geoInput !== undefined && !isRecord(geoInput)) throw new Error('geo_must_be_object')

  if (requestedRadius !== undefined && geoInput === undefined) {
    throw new Error('geo_location_required_for_radius')
  }

  if (geoInput === undefined) {
    return { query, domainSlug, intent, tier: input.tier, maxResults }
  }

  const address = typeof geoInput.address === 'string' ? geoInput.address.trim() : ''
  const lat = geoInput.lat
  const lng = geoInput.lng
  const hasAddress = address.length > 0 && address.length <= 200
  const hasCoordinates =
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180

  if (!hasAddress && !hasCoordinates) throw new Error('geo_location_required')

  const geo: RequestBody['geo'] = {}
  if (hasAddress) geo.address = address
  if (hasCoordinates) {
    geo.lat = lat
    geo.lng = lng
  }

  return {
    query,
    domainSlug,
    intent,
    geo,
    ...(requestedRadius === undefined ? {} : { radiusMinutes: requestedRadius }),
    tier: input.tier,
    maxResults,
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('adapter_timeout')), timeoutMs)
    }),
  ])
}

function validSourceUrl(sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeListing(listing: RawListing): RawListing | null {
  const sourceUrl = listing.sourceUrl.trim()
  const name = listing.name.trim()
  if (!sourceUrl || !name || !validSourceUrl(sourceUrl)) return null
  if (listing.geo) {
    if (!isFiniteNumber(listing.geo.lat) || !isFiniteNumber(listing.geo.lng)) return null
    if (
      listing.geo.lat < -90 ||
      listing.geo.lat > 90 ||
      listing.geo.lng < -180 ||
      listing.geo.lng > 180
    ) {
      return null
    }
  }

  return {
    sourceUrl,
    name: name.slice(0, 300),
    ...(listing.geo ? { geo: listing.geo } : {}),
    ...(typeof listing.rating === 'number' && Number.isFinite(listing.rating)
      ? { rating: Math.min(5, Math.max(0, listing.rating)) }
      : { rating: null }),
    ...(typeof listing.price === 'number' && Number.isFinite(listing.price) && listing.price >= 0
      ? { price: listing.price }
      : { price: null }),
    ...(typeof listing.currency === 'string' && /^[A-Z]{3}$/.test(listing.currency)
      ? { currency: listing.currency }
      : { currency: null }),
    ...(listing.data ? { data: listing.data } : {}),
    ...(listing.text ? { text: listing.text.slice(0, 10000) } : {}),
  }
}

function buildCandidate(
  listing: RawListing,
  source: string,
  driveMinutes: number | undefined,
  index: number,
  objectiveScore: number | null,
  hardConstraintStatus: 'pass' | 'unknown',
): CandidateDraft {
  const data: Record<string, unknown> = { ...(listing.data ?? {}) }
  if (listing.text) data.sourceText = listing.text
  if (listing.price !== null && listing.price !== undefined) data.price = listing.price
  if (listing.currency) data.currency = listing.currency
  data.hardConstraintStatus = hardConstraintStatus

  return {
    id: `candidate-${index + 1}`,
    source,
    sourceUrl: listing.sourceUrl,
    name: listing.name,
    geo: {
      ...(listing.geo ?? {}),
      ...(driveMinutes === undefined ? {} : { driveMinutes }),
    },
    rating: typeof listing.rating === 'number' ? listing.rating : null,
    price: typeof listing.price === 'number' ? listing.price : null,
    currency: typeof listing.currency === 'string' ? listing.currency : null,
    objectiveScore,
    hardConstraintStatus,
    data,
  }
}

function scoreCandidate(
  listing: RawListing,
  driveMinutes: number | undefined,
  intent: ResearchIntent,
): number | null {
  const ratingScore = typeof listing.rating === 'number' ? listing.rating / 5 : null
  const priceLimit = intent.hardConstraints.maxPrice
  const priceScore =
    typeof listing.price === 'number' && priceLimit !== undefined
      ? Math.max(0, 1 - listing.price / priceLimit)
      : null
  const distanceLimit = intent.hardConstraints.maxDriveMinutes
  const distanceScore =
    driveMinutes !== undefined && distanceLimit !== undefined
      ? Math.max(0, 1 - driveMinutes / distanceLimit)
      : null

  const scores = {
    best_overall: [ratingScore, priceScore, distanceScore],
    best_value: [ratingScore, priceScore],
    lowest_cost: [priceScore],
    closest: [distanceScore],
    highest_quality: [ratingScore],
    lowest_risk: [ratingScore],
  }[intent.objective].filter((score): score is number => score !== null)

  return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null
}

function assessHardConstraints(
  listing: RawListing,
  driveMinutes: number | undefined,
  intent: ResearchIntent,
): 'reject' | 'pass' | 'unknown' {
  const unknown =
    (intent.hardConstraints.maxPrice !== undefined && listing.price === null) ||
    (intent.hardConstraints.minRating !== undefined && listing.rating === null)
  if (
    intent.hardConstraints.maxPrice !== undefined &&
    typeof listing.price === 'number' &&
    listing.price > intent.hardConstraints.maxPrice
  ) {
    return 'reject'
  }
  if (
    intent.hardConstraints.minRating !== undefined &&
    typeof listing.rating === 'number' &&
    listing.rating < intent.hardConstraints.minRating
  ) {
    return 'reject'
  }
  if (intent.hardConstraints.maxDriveMinutes !== undefined && driveMinutes === undefined) {
    return 'unknown'
  }
  return unknown ? 'unknown' : 'pass'
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null
  const values = value.map((item) => (typeof item === 'string' ? item.trim() : ''))
  if (values.some((item) => item.length === 0 || item.length > 500)) return null
  return values
}

export function parseSentiment(value: unknown, model: string): AnalysisDraft | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }

  if (!isRecord(parsed)) return null
  const sentimentScore = parsed.sentimentScore
  const pros = stringArray(parsed.pros)
  const cons = stringArray(parsed.cons)
  const defects = stringArray(parsed.defects)
  const summary = parsed.summary

  if (
    !isFiniteNumber(sentimentScore) ||
    sentimentScore < -1 ||
    sentimentScore > 1 ||
    !pros ||
    !cons ||
    !defects ||
    typeof summary !== 'string' ||
    summary.length > 1000
  ) {
    return null
  }

  return {
    sentimentScore,
    pros,
    cons,
    defects,
    sourceSummary: summary.trim(),
    model,
  }
}

async function waitForSource(source: SourceAdapter, lastCallAt: Map<string, number>) {
  const interval = source.minIntervalMs ?? 0
  const previous = lastCallAt.get(source.id) ?? 0
  const wait = interval - (Date.now() - previous)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastCallAt.set(source.id, Date.now())
}

export async function runPipeline(
  request: RequestBody,
  dependencies: PipelineDependencies,
): Promise<ScrapeResponse> {
  const origin = request.geo
    ? isFiniteNumber(request.geo.lat) && isFiniteNumber(request.geo.lng)
      ? { lat: request.geo.lat, lng: request.geo.lng }
      : await dependencies.geo.resolve(request.geo.address ?? '')
    : undefined

  const lastCallAt = new Map<string, number>()
  const collected: Array<{ source: string; listing: RawListing }> = []

  for (const source of dependencies.sources) {
    await waitForSource(source, lastCallAt)
    const listings = await withTimeout(
      source.fetch(request.query, origin, request.radiusMinutes),
      source.timeoutMs ?? 15_000,
    )
    for (const listing of listings.slice(0, request.maxResults * 3)) {
      collected.push({ source: source.id, listing })
    }
  }

  const seenUrls = new Set<string>()
  const accepted: Array<{
    source: string
    listing: RawListing
    driveMinutes?: number
    hardConstraintStatus: 'pass' | 'unknown'
  }> = []

  for (const item of collected) {
    const listing = normalizeListing(item.listing)
    if (!listing || seenUrls.has(listing.sourceUrl)) continue

    let driveMinutes: number | undefined
    if (origin && request.radiusMinutes !== undefined) {
      if (!listing.geo) continue
      driveMinutes = await withTimeout(dependencies.geo.driveMinutes(origin, listing.geo), 5_000)
      if (
        !isFiniteNumber(driveMinutes) ||
        driveMinutes < 0 ||
        driveMinutes > request.radiusMinutes
      ) {
        continue
      }
    }

    const constraintStatus = assessHardConstraints(listing, driveMinutes, request.intent)
    if (constraintStatus === 'reject') continue

    seenUrls.add(listing.sourceUrl)
    accepted.push({
      source: item.source,
      listing,
      driveMinutes,
      hardConstraintStatus: constraintStatus,
    })
    if (accepted.length >= request.maxResults) break
  }

  const candidates = accepted.map((item, index) =>
    buildCandidate(
      item.listing,
      item.source,
      item.driveMinutes,
      index,
      scoreCandidate(item.listing, item.driveMinutes, request.intent),
      item.hardConstraintStatus,
    ),
  )
  const analysis: Record<string, AnalysisDraft | null> = {}

  await Promise.all(
    accepted.map(async (item, index) => {
      const candidateId = `candidate-${index + 1}`
      try {
        const result = await dependencies.sentiment.analyze(item.listing, {
          query: request.query,
          domainSlug: request.domainSlug,
        })
        analysis[candidateId] = parseSentiment(result, dependencies.model)
      } catch {
        analysis[candidateId] = null
      }
    }),
  )

  return { candidates, analysis }
}
