import type { GeoAdapter, GeoPoint } from './pipeline.ts'

export class GeoProviderError extends Error {
  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`)
    this.name = 'GeoProviderError'
  }
}

const DEFAULT_NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org'
const DEFAULT_OSRM_ENDPOINT = 'https://router.project-osrm.org'
const DEFAULT_USER_AGENT = 'ConvergeResearch/0.1 (local research app; dev only)'
const NOMINATIM_MIN_INTERVAL_MS = 1100
const NOMINATIM_TIMEOUT_MS = 10_000
const OSRM_TIMEOUT_MS = 8_000

interface NominatimResult {
  lat?: string
  lon?: string
}

interface OsrmResponse {
  code?: string
  routes?: Array<{ duration?: number }>
}

export interface GeoAdapterOptions {
  nominatimEndpoint?: string
  osrmEndpoint?: string
  userAgent?: string
}

function toCoord(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function createGeoAdapter(options: GeoAdapterOptions = {}): GeoAdapter {
  const nominatimEndpoint = options.nominatimEndpoint ?? DEFAULT_NOMINATIM_ENDPOINT
  const osrmEndpoint = options.osrmEndpoint ?? DEFAULT_OSRM_ENDPOINT
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT
  let lastResolveAt = Number.NEGATIVE_INFINITY

  return {
    async resolve(address) {
      const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastResolveAt)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      lastResolveAt = Date.now()

      const url = `${nominatimEndpoint}/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS)
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': userAgent },
          signal: controller.signal,
        })
        if (!response.ok) throw new GeoProviderError('nominatim', `http_${response.status}`)

        const body = (await response.json()) as NominatimResult[]
        const first = body[0]
        if (!first) throw new GeoProviderError('nominatim', 'no_result')

        const lat = toCoord(first.lat)
        const lng = toCoord(first.lon)
        if (lat === null || lng === null)
          throw new GeoProviderError('nominatim', 'invalid_coordinates')

        return { lat, lng }
      } catch (error) {
        if (error instanceof GeoProviderError) throw error
        throw new GeoProviderError('nominatim', 'timeout')
      } finally {
        clearTimeout(timer)
      }
    },

    async driveMinutes(from: GeoPoint, to: GeoPoint) {
      const url = `${osrmEndpoint}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new GeoProviderError('osrm', `http_${response.status}`)

        const body = (await response.json()) as OsrmResponse
        const duration = body.code === 'Ok' ? body.routes?.[0]?.duration : undefined
        if (typeof duration !== 'number' || !Number.isFinite(duration)) {
          throw new GeoProviderError('osrm', 'no_route')
        }

        return Math.ceil(duration / 60)
      } catch (error) {
        if (error instanceof GeoProviderError) throw error
        throw new GeoProviderError('osrm', 'timeout')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
