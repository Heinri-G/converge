import { createGateAdapter } from './gate.ts'
import type { CatalogAttribute } from './gate.ts'

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

const OBJECTIVES = new Set([
  'best_overall',
  'best_value',
  'lowest_cost',
  'closest',
  'highest_quality',
  'lowest_risk',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface ValidatedBody {
  topic: string
  domainSlug: string
  intent: {
    objective: string
    hardConstraints: Record<string, unknown>
    preferences: Record<string, unknown>
  }
  catalog?: CatalogAttribute[]
  answered?: string[]
}

function isCatalogAttribute(value: unknown): value is CatalogAttribute {
  if (!isRecord(value)) return false
  const target = value.target
  return (
    typeof value.slug === 'string' &&
    value.slug.length > 0 &&
    value.slug.length <= 100 &&
    typeof value.label === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.tooltip === 'string' &&
    (value.answerType === 'single' || value.answerType === 'boolean') &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.value === 'string' &&
        typeof option.label === 'string',
    ) &&
    isRecord(target) &&
    (target.kind === 'constraint' || target.kind === 'preference') &&
    typeof target.field === 'string' &&
    (target.valueType === 'number' ||
      target.valueType === 'string' ||
      target.valueType === 'boolean')
  )
}

function validateRequestBody(input: unknown): ValidatedBody {
  if (!isRecord(input)) throw new Error('request_body_must_be_object')

  const topic = typeof input.topic === 'string' ? input.topic.trim() : ''
  if (topic.length < 2 || topic.length > 200) throw new Error('topic_length_invalid')

  const domainSlug = typeof input.domainSlug === 'string' ? input.domainSlug.trim() : ''
  if (domainSlug.length < 1 || domainSlug.length > 100) throw new Error('domain_slug_invalid')

  const intent = input.intent
  if (!isRecord(intent)) throw new Error('intent_must_be_object')
  if (typeof intent.objective !== 'string' || !OBJECTIVES.has(intent.objective)) {
    throw new Error('intent_objective_invalid')
  }
  if (!isRecord(intent.hardConstraints)) throw new Error('intent_constraints_invalid')
  if (!isRecord(intent.preferences)) throw new Error('intent_preferences_invalid')

  let catalog: CatalogAttribute[] | undefined
  if (input.catalog !== undefined) {
    if (
      !Array.isArray(input.catalog) ||
      input.catalog.length > 50 ||
      !input.catalog.every(isCatalogAttribute)
    ) {
      throw new Error('catalog_invalid')
    }
    catalog = input.catalog
  }

  let answered: string[] | undefined
  if (input.answered !== undefined) {
    if (
      !Array.isArray(input.answered) ||
      input.answered.length > 50 ||
      !input.answered.every((slug) => typeof slug === 'string' && slug.length <= 100)
    ) {
      throw new Error('answered_invalid')
    }
    answered = input.answered
  }

  return {
    topic,
    domainSlug,
    intent: {
      objective: intent.objective,
      hardConstraints: intent.hardConstraints,
      preferences: intent.preferences,
    },
    ...(catalog === undefined ? {} : { catalog }),
    ...(answered === undefined ? {} : { answered }),
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

  let validated: ValidatedBody
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

  const adapter = createGateAdapter({
    apiKey: Deno.env.get('LLM_API_KEY') ?? '',
    baseUrl: Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL,
    model: Deno.env.get('LLM_MODEL') ?? '',
  })

  try {
    return json(await adapter.generate(validated))
  } catch (error) {
    if (error instanceof Error && error.name === 'LlmProviderError') {
      return json({ error: 'gate_generation_failed' }, 502)
    }
    return json({ error: 'gate_generation_failed' }, 502)
  }
}

Deno.serve(handleRequest)