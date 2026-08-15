import {
  ProviderNotConfiguredError,
  runPipeline,
  validateRequestBody,
  type GeoAdapter,
  type PipelineDependencies,
  type SentimentAdapter,
  type SourceAdapter,
} from './pipeline.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function notConfiguredDependencies(): PipelineDependencies {
  const missingProvider = (name: string): ProviderNotConfiguredError =>
    new ProviderNotConfiguredError(name)

  const geo: GeoAdapter = {
    async resolve() {
      throw missingProvider('geo')
    },
    async driveMinutes() {
      throw missingProvider('geo')
    },
  }
  const source: SourceAdapter = {
    id: 'unconfigured',
    async fetch() {
      throw missingProvider('scrape')
    },
  }
  const sentiment: SentimentAdapter = {
    async analyze() {
      throw missingProvider('sentiment')
    },
  }

  return { geo, sources: [source], sentiment, model: Deno.env.get('LLM_MODEL') ?? '' }
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
    return json(await runPipeline(validated, notConfiguredDependencies()))
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return json({ error: 'providers_not_configured' }, 503)
    }
    return json({ error: 'scrape_pipeline_failed' }, 502)
  }
}

Deno.serve(handleRequest)
