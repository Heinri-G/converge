import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGeoAdapter, GeoProviderError } from './geo'
import { createOverpassSource, createTavilySource, SourceProviderError } from './sources'
import { analysisSchema, createSentimentAdapter, LlmProviderError } from './sentiment'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('geo adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves an address through Nominatim', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ lat: '52.0907', lon: '5.1214' }]),
    )
    const geo = createGeoAdapter()
    const point = await geo.resolve('Utrecht')
    expect(point).toEqual({ lat: 52.0907, lng: 5.1214 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.host).toBe('nominatim.openstreetmap.org')
    expect(url.searchParams.get('q')).toBe('Utrecht')
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
    expect(headers['User-Agent']).toBeTruthy()
  })

  it('throws when Nominatim has no result or bad coordinates', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await expect(createGeoAdapter().resolve('nowhere')).rejects.toBeInstanceOf(GeoProviderError)

    fetchMock.mockResolvedValue(jsonResponse([{ lat: 'nope', lon: '5.1214' }]))
    await expect(createGeoAdapter().resolve('junk')).rejects.toBeInstanceOf(GeoProviderError)
  })

  it('converts OSRM duration seconds to whole minutes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'Ok', routes: [{ duration: 735 }] }),
    )
    const minutes = await createGeoAdapter().driveMinutes(
      { lat: 52.1, lng: 5.1 },
      { lat: 52.2, lng: 5.2 },
    )
    expect(minutes).toBe(13)

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.pathname).toContain('/driving/5.1,52.1;5.2,52.2')
  })

  it('throws when OSRM reports an error or no route', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'NoRoute', routes: [] }))
    await expect(
      createGeoAdapter().driveMinutes({ lat: 52.1, lng: 5.1 }, { lat: 52.2, lng: 5.2 }),
    ).rejects.toBeInstanceOf(GeoProviderError)
  })
})

describe('overpass source', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns no listings without a geo origin', async () => {
    const listings = await createOverpassSource('coffee-espresso').fetch('coffee espresso')
    expect(listings).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('parses nodes and ways into listings with OSM source URLs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        elements: [
          {
            type: 'node',
            id: 1001,
            lat: 52.1,
            lon: 5.1,
            tags: { name: 'Cafe De Koffie', website: 'https://cafedekoffie.nl' },
          },
          {
            type: 'way',
            id: 2001,
            center: { lat: 52.11, lon: 5.11 },
            tags: { name: 'Roastery Zuid' },
          },
          { type: 'node', id: 1002, lat: 52.1, lon: 5.1, tags: {} },
          { type: 'node', id: 1003, lat: 52.1, lon: 5.1, tags: { name: 'No Coords' } },
        ],
      }),
    )
    const listings = await createOverpassSource('coffee-espresso').fetch('coffee espresso', {
      lat: 52.1,
      lng: 5.1,
    })

    expect(listings).toHaveLength(3)
    expect(listings[0]).toMatchObject({
      sourceUrl: 'https://www.openstreetmap.org/node/1001',
      name: 'Cafe De Koffie',
      geo: { lat: 52.1, lng: 5.1 },
      data: { website: 'https://cafedekoffie.nl' },
    })
    expect(listings[1]?.geo).toEqual({ lat: 52.11, lng: 5.11 })
    expect(listings[2]).toMatchObject({
      sourceUrl: 'https://www.openstreetmap.org/node/1003',
      name: 'No Coords',
    })

    const call = fetchMock.mock.calls[0]
    const body = new URLSearchParams(call?.[1]?.body as string).get('data') ?? ''
    expect(body).toContain('nwr[amenity=cafe]')
    expect(body).toContain('around:15000,52.1,5.1')
  })

  it('returns no listings for a domain without a tag mapping', async () => {
    const listings = await createOverpassSource('unknown-domain').fetch('anything', {
      lat: 52.1,
      lng: 5.1,
    })
    expect(listings).toEqual([])
  })

  it('throws on a non-2xx Overpass response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'too many requests' }, 429))
    await expect(
      createOverpassSource('coffee-espresso').fetch('coffee espresso', { lat: 52.1, lng: 5.1 }),
    ).rejects.toBeInstanceOf(SourceProviderError)
  })
})

describe('tavily source', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps search results to text-bearing listings', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { title: 'Best budget espresso machines 2026', url: 'https://example.com/budget', content: 'Consensus: ...' },
          { title: '', url: 'https://example.com/empty' },
          { title: 'No URL', url: '' },
        ],
      }),
    )
    const listings = await createTavilySource('test-key').fetch('best budget espresso machine')

    expect(listings).toHaveLength(1)
    expect(listings[0]).toEqual({
      sourceUrl: 'https://example.com/budget',
      name: 'Best budget espresso machines 2026',
      text: 'Consensus: ...',
    })

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body.api_key).toBe('test-key')
    expect(body.query).toBe('best budget espresso machine')
  })

  it('throws on a non-2xx Tavily response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'quota exceeded' }, 429))
    await expect(createTavilySource('test-key').fetch('espresso')).rejects.toBeInstanceOf(
      SourceProviderError,
    )
  })
})

describe('llm sentiment adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function adapter() {
    return createSentimentAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://llm.example.com/v1/',
      model: 'test-model',
    })
  }

  it('sends a chat completions request and returns the validated analysis', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentimentScore: 0.6,
                pros: ['sturdy build'],
                cons: ['noisy pump'],
                defects: ['several owners report leaking gaskets'],
                summary: 'Mostly positive, one recurring defect.',
              }),
            },
          },
        ],
      }),
    )
    const result = await adapter().analyze(
      {
        sourceUrl: 'https://example.com/item',
        name: 'Gaggia Classic',
        text: 'Review text with repeated mentions of gasket leaks',
      },
      { query: 'best entry espresso machine', domainSlug: 'coffee-espresso' },
    )

    expect(result).toEqual({
      sentimentScore: 0.6,
      pros: ['sturdy build'],
      cons: ['noisy pump'],
      defects: ['several owners report leaking gaskets'],
      summary: 'Mostly positive, one recurring defect.',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://llm.example.com/v1/chat/completions')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('test-model')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].content).toContain('Gaggia Classic')
  })

  it('throws on HTTP failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'bad key' }, 401))
    await expect(
      adapter().analyze(
        { sourceUrl: 'https://example.com/item', name: 'X' },
        { query: 'q', domainSlug: 'd' },
      ),
    ).rejects.toBeInstanceOf(LlmProviderError)
  })

  it('throws when the model output is not valid JSON or fails the schema', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'not json' } }] }),
    )
    await expect(
      adapter().analyze(
        { sourceUrl: 'https://example.com/item', name: 'X' },
        { query: 'q', domainSlug: 'd' },
      ),
    ).rejects.toBeInstanceOf(LlmProviderError)

    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          { message: { content: JSON.stringify({ sentimentScore: 7, pros: [], cons: [], defects: [], summary: 'x' }) } },
        ],
      }),
    )
    await expect(
      adapter().analyze(
        { sourceUrl: 'https://example.com/item', name: 'X' },
        { query: 'q', domainSlug: 'd' },
      ),
    ).rejects.toBeInstanceOf(LlmProviderError)
  })

  it('exposes a schema that matches the pipeline analysis contract', () => {
    expect(
      analysisSchema.safeParse({
        sentimentScore: 0,
        pros: ['a'],
        cons: [],
        defects: [],
        summary: 's',
      }).success,
    ).toBe(true)
    expect(analysisSchema.safeParse({ sentimentScore: 1.5, pros: [], cons: [], defects: [], summary: 's' }).success).toBe(false)
    expect(analysisSchema.safeParse({ sentimentScore: 0, pros: [''], cons: [], defects: [], summary: 's' }).success).toBe(false)
  })
})
