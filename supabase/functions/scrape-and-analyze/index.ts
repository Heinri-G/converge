import {
  runPipeline,
  validateRequestBody,
  type PipelineDependencies,
  type RequestBody,
} from './pipeline.ts'
import { createGeoAdapter } from './geo.ts'
import { createOverpassSource, createTavilySource } from './sources.ts'
import { createSentimentAdapter } from './sentiment.ts'
import { createSpecsAdapter } from './specs.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function buildDependencies(request: RequestBody): PipelineDependencies {
  const model = Deno.env.get('LLM_MODEL') ?? ''
  const sources = [createOverpassSource(request.domainSlug)]
  const tavilyKey = Deno.env.get('TAVILY_API_KEY')
  if (tavilyKey) sources.push(createTavilySource(tavilyKey))

  return {
    geo: createGeoAdapter(),
    sources,
    sentiment: createSentimentAdapter({
      apiKey: Deno.env.get('LLM_API_KEY') ?? '',
      baseUrl: Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL,
      model,
    }),
    specs: createSpecsAdapter({
      apiKey: Deno.env.get('LLM_API_KEY') ?? '',
      baseUrl: Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL,
      model,
    }),
    model,
  }
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  let validated
  try {
    validated = validateRequestBody(body)
  } catch (error) {
    return json(
      { error: 'invalid_request', code: error instanceof Error ? error.message : 'invalid_body' },
      400,
    )
  }

  const missingSecrets = ['LLM_API_KEY', 'LLM_MODEL'].filter((name) => !Deno.env.get(name))
  if (missingSecrets.length > 0) {
    return json({ error: 'providers_not_configured' }, 503)
  }

  try {
    return json(await runPipeline(validated, buildDependencies(validated)))
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'GeoProviderError') return json({ error: 'geocode_failed' }, 502)
      if (error.name === 'LlmProviderError') return json({ error: 'sentiment_failed' }, 502)
      if (error.name === 'SourceProviderError') return json({ error: 'source_failed' }, 502)
    }
    return json({ error: 'scrape_pipeline_failed' }, 502)
  }
}

Deno.serve(handleRequest)
