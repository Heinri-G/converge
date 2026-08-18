// promote-catalog — persists an LLM-generated gate as a `source='generated'`
// domain catalog so later sessions (and guests) reuse it without an LLM call.
//
// This is the single documented exception to "Edge Functions never write to
// the DB": the catalog tables are T4 (public read, writes via migration only),
// so the only runtime writer is this function. It validates the gate, verifies
// the caller owns a research session for the domain (anti-spam), and never
// overwrites an authored/curated catalog.

import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

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

const MAX_GROUPS = 2
const MAX_QUESTIONS_PER_GROUP = 2
const MAX_ATTRIBUTES = 10

const CONSTRAINT_FIELDS: Record<string, 'number' | 'string'> = {
  maxPrice: 'number',
  minRating: 'number',
  maxDriveMinutes: 'number',
  availableBy: 'string',
}

const RESERVED_PREFERENCE_FIELDS = new Set([
  'context',
  'locallyOrderable',
  'shippingCountry',
  'budgetFocused',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface ValidatedQuestion {
  id: string
  prompt: string
  tooltip: string
  answerType: 'single' | 'boolean'
  options: Array<{ value: string; label: string }>
  target: { kind: 'constraint' | 'preference'; field: string; valueType: string }
}

interface ValidatedGate {
  groups: Array<{
    id: string
    title: string
    rationale: string
    questions: ValidatedQuestion[]
  }>
}

function validateGate(value: unknown): ValidatedGate {
  if (!isRecord(value) || !Array.isArray(value.groups) || value.groups.length > MAX_GROUPS) {
    throw new Error('gate_invalid')
  }

  const groups = value.groups
    .map((group) => {
      if (
        !isRecord(group) ||
        typeof group.id !== 'string' ||
        typeof group.title !== 'string' ||
        typeof group.rationale !== 'string' ||
        !Array.isArray(group.questions) ||
        group.questions.length === 0 ||
        group.questions.length > MAX_QUESTIONS_PER_GROUP
      ) {
        return null
      }
      const questions = group.questions
        .map((question) => {
          if (!isRecord(question)) return null
          if (
            typeof question.id !== 'string' ||
            question.id.length === 0 ||
            question.id.length > 100 ||
            typeof question.prompt !== 'string' ||
            question.prompt.length === 0 ||
            question.prompt.length > 200 ||
            typeof question.tooltip !== 'string' ||
            question.tooltip.length === 0 ||
            question.tooltip.length > 300 ||
            (question.answerType !== 'single' && question.answerType !== 'boolean') ||
            !Array.isArray(question.options) ||
            question.options.length > 8 ||
            !question.options.every(
              (option) =>
                isRecord(option) &&
                typeof option.value === 'string' &&
                option.value.length <= 100 &&
                typeof option.label === 'string' &&
                option.label.length <= 120,
            )
          ) {
            return null
          }

          const target = question.target
          if (!isRecord(target)) return null
          if (target.kind !== 'constraint' && target.kind !== 'preference') return null
          if (typeof target.field !== 'string' || target.field.length === 0 || target.field.length > 50) {
            return null
          }
          if (
            target.valueType !== 'number' &&
            target.valueType !== 'string' &&
            target.valueType !== 'boolean'
          ) {
            return null
          }

          if (target.kind === 'constraint') {
            const expectedType = CONSTRAINT_FIELDS[target.field]
            if (!expectedType || target.valueType !== expectedType) return null
          } else {
            if (RESERVED_PREFERENCE_FIELDS.has(target.field)) return null
            if (target.valueType === 'number' && question.answerType === 'boolean') return null
          }

          return {
            id: question.id,
            prompt: question.prompt,
            tooltip: question.tooltip,
            answerType: question.answerType,
            options: question.options as Array<{ value: string; label: string }>,
            target: target as ValidatedQuestion['target'],
          }
        })
        .filter((question): question is ValidatedQuestion => question !== null)

      return questions.length > 0
        ? {
            id: group.id,
            title: group.title,
            rationale: group.rationale,
            questions,
          }
        : null
    })
    .filter((group): group is NonNullable<typeof group> => group !== null)

  if (groups.length === 0) throw new Error('gate_invalid')
  return { groups }
}

function attributesFromGate(gate: ValidatedGate, catalogId: string): Array<Record<string, unknown>> {
  const attributes: Array<Record<string, unknown>> = []
  for (const group of gate.groups) {
    for (const question of group.questions) {
      if (question.target.kind !== 'preference') continue
      attributes.push({
        catalog_id: catalogId,
        slug: question.target.field,
        label: question.target.field.replace(/_/g, ' '),
        prompt: question.prompt,
        tooltip: question.tooltip,
        answer_type: question.answerType,
        options: question.options,
        keywords: [],
        priority: attributes.length + 1,
        ordering: attributes.length,
        target_kind: 'preference',
        target_field: question.target.field,
        target_value_type: question.target.valueType,
      })
      if (attributes.length >= MAX_ATTRIBUTES) break
    }
    if (attributes.length >= MAX_ATTRIBUTES) break
  }
  return attributes
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1] ?? null
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'providers_not_configured' }, 503)

  const token = bearerToken(request.headers.get('authorization'))
  if (!token) return json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!isRecord(body)) return json({ error: 'invalid_request' }, 400)
  const domainSlug = typeof body.domainSlug === 'string' ? body.domainSlug.trim() : ''
  if (domainSlug.length < 1 || domainSlug.length > 100) {
    return json({ error: 'invalid_request', code: 'domain_slug_invalid' }, 400)
  }

  let gate: ValidatedGate
  try {
    gate = validateGate(body.gate)
  } catch (error) {
    return json(
      { error: 'invalid_request', code: error instanceof Error ? error.message : 'gate_invalid' },
      400,
    )
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  const userId = userData?.user?.id
  if (userError || !userId) return json({ error: 'unauthorized' }, 401)

  const { data: ownedSessions, error: sessionError } = await userClient
    .from('research_sessions')
    .select('id')
    .eq('domain_slug', domainSlug)
    .in('resolution', ['complete', 'fast_tracked', 'in_progress'])
    .limit(1)

  if (sessionError) return json({ error: 'session_check_failed' }, 502)
  if (!ownedSessions || ownedSessions.length === 0) {
    return json({ error: 'forbidden', code: 'no_session_for_domain' }, 403)
  }

  const serviceClient = createClient(url, serviceKey)
  const { data: existing, error: existingError } = await serviceClient
    .from('domain_catalogs')
    .select('id, status, source')
    .eq('domain_slug', domainSlug)
    .maybeSingle()

  if (existingError) return json({ error: 'catalog_read_failed' }, 502)

  if (existing && existing.source !== 'generated') {
    return json({ catalogId: existing.id, status: 'kept' })
  }

  let catalogId: string
  let status: 'created' | 'updated'
  if (existing) {
    catalogId = existing.id
    status = 'updated'
    const { error: deleteError } = await serviceClient
      .from('domain_attributes')
      .delete()
      .eq('catalog_id', catalogId)
    if (deleteError) return json({ error: 'catalog_write_failed' }, 502)
    const { error: updateError } = await serviceClient
      .from('domain_catalogs')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', catalogId)
    if (updateError) return json({ error: 'catalog_write_failed' }, 502)
  } else {
    const { data: created, error: insertError } = await serviceClient
      .from('domain_catalogs')
      .insert({ domain_slug: domainSlug, status: 'draft', source: 'generated', created_by: userId })
      .select('id')
      .single()
    if (insertError || !created) return json({ error: 'catalog_write_failed' }, 502)
    catalogId = created.id
    status = 'created'
  }

  const attributes = attributesFromGate(gate, catalogId)
  if (attributes.length > 0) {
    const { error: attrError } = await serviceClient.from('domain_attributes').insert(attributes)
    if (attrError) return json({ error: 'catalog_write_failed' }, 502)
  }

  return json({ catalogId, status })
}

Deno.serve(handleRequest)