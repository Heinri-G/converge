import type { GeoPoint, RawListing, SourceAdapter } from './pipeline.ts'

export class SourceProviderError extends Error {
  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`)
    this.name = 'SourceProviderError'
  }
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const TAVILY_ENDPOINT = 'https://api.tavily.com/search'
const OVERPASS_RADIUS_METERS = 15_000
const OVERPASS_TIMEOUT_SECONDS = 25

const DOMAIN_OVERPASS_TAGS: Record<string, string[]> = {
  'coffee-espresso': ['amenity=cafe', 'shop=coffee'],
  restaurants: ['amenity=restaurant'],
  hotels: ['tourism=hotel'],
  golf: ['leisure=golf_course'],
}

interface OverpassElement {
  type?: string
  id?: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

function elementGeo(element: OverpassElement): GeoPoint | null {
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
}

export function createOverpassSource(domainSlug: string): SourceAdapter {
  const tags = DOMAIN_OVERPASS_TAGS[domainSlug] ?? []

  return {
    id: 'overpass',
    timeoutMs: 20_000,
    minIntervalMs: 5_000,
    async fetch(_query, geo) {
      if (!geo || tags.length === 0) return []

      const body =
        `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];` +
        '(' +
        tags
          .map(
            (tag) =>
              `nwr[${tag}](around:${OVERPASS_RADIUS_METERS},${geo.lat},${geo.lng});`,
          )
          .join('') +
        ');' +
        'out center 50;'

      const response = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(body)}`,
      })
      if (!response.ok) throw new SourceProviderError('overpass', `http_${response.status}`)

      const parsed = (await response.json()) as OverpassResponse
      const listings: RawListing[] = []

      for (const element of parsed.elements ?? []) {
        const name = element.tags?.name
        if (typeof element.type !== 'string' || typeof element.id !== 'number') continue
        const geoPoint = elementGeo(element)
        if (!geoPoint || !name?.trim()) continue

        const data: Record<string, unknown> = {}
        const website = element.tags?.website ?? element.tags?.['contact:website']
        if (website) data.website = website
        if (element.tags?.phone) data.phone = element.tags.phone

        listings.push({
          sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          name: name.trim(),
          geo: geoPoint,
          data,
        })
      }

      return listings
    },
  }
}

interface TavilyResult {
  title?: string
  url?: string
  content?: string
}

interface TavilyResponse {
  results?: TavilyResult[]
}

export function createTavilySource(apiKey: string): SourceAdapter {
  return {
    id: 'tavily',
    timeoutMs: 15_000,
    minIntervalMs: 3_000,
    async fetch(query) {
      const response = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 10,
          search_depth: 'advanced',
          include_answer: false,
          topic: 'general',
        }),
      })
      if (!response.ok) throw new SourceProviderError('tavily', `http_${response.status}`)

      const parsed = (await response.json()) as TavilyResponse
      const listings: RawListing[] = []

      for (const result of parsed.results ?? []) {
        if (typeof result.title !== 'string' || typeof result.url !== 'string') continue
        if (!result.title.trim() || !result.url.trim()) continue

        listings.push({
          sourceUrl: result.url,
          name: result.title.trim().slice(0, 300),
          ...(typeof result.content === 'string' && result.content
            ? { text: result.content.slice(0, 10_000) }
            : {}),
        })
      }

      return listings
    },
  }
}
