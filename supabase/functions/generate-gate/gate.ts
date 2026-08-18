import { z } from 'npm:zod@4.4.3'

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(`llm: ${message}`)
    this.name = 'LlmProviderError'
  }
}

const LLM_TIMEOUT_MS = 30_000

export const MAX_GROUPS = 2
export const MAX_QUESTIONS_PER_GROUP = 2

const optionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
})

const questionSchema = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().min(1).max(200),
  tooltip: z.string().min(1).max(300),
  answerType: z.enum(['single', 'boolean']),
  options: z.array(optionSchema),
  target: z.object({
    kind: z.enum(['constraint', 'preference']),
    field: z.string().min(1).max(50),
    valueType: z.enum(['number', 'string', 'boolean']),
  }),
})

const groupSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(80),
  rationale: z.string().min(1).max(300),
  questions: z.array(questionSchema).min(1).max(MAX_QUESTIONS_PER_GROUP),
})

export const gateSchema = z.object({
  groups: z.array(groupSchema).max(MAX_GROUPS),
})

export type GeneratedGate = z.infer<typeof gateSchema>

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

function sanitizeQuestion(question: z.infer<typeof questionSchema>): z.infer<typeof questionSchema> | null {
  if (question.target.kind === 'constraint') {
    const expectedType = CONSTRAINT_FIELDS[question.target.field]
    if (!expectedType) return null
    if (question.target.valueType !== expectedType) return null
  } else {
    if (RESERVED_PREFERENCE_FIELDS.has(question.target.field)) return null
    if (question.target.valueType === 'number' && question.answerType === 'boolean') return null
  }
  return question
}

export function sanitizeGate(value: unknown): GeneratedGate {
  const result = gateSchema.safeParse(value)
  if (!result.success) throw new LlmProviderError('invalid_shape')

  const groups = result.data.groups
    .map((group) => ({
      ...group,
      questions: group.questions
        .map(sanitizeQuestion)
        .filter((question): question is NonNullable<typeof question> => question !== null),
    }))
    .filter((group) => group.questions.length > 0)

  return { groups }
}

export interface CatalogAttribute {
  slug: string
  label: string
  prompt: string
  tooltip: string
  answerType: 'single' | 'boolean'
  options: Array<{ value: string; label: string }>
  target: {
    kind: 'constraint' | 'preference'
    field: string
    valueType: 'number' | 'string' | 'boolean'
  }
}

const SYSTEM_PROMPT = `You are the "stage gate" of a research engine. Given a user's research prompt, the parsed intent, and the domain's attribute catalog, decide what important information is still missing and ask for it.

Return ONLY strict JSON with exactly this shape:
{"groups":[{"id":string,"title":string,"rationale":string,"questions":[{"id":string,"prompt":string,"tooltip":string,"answerType":"single"|"boolean","options":[{"value":string,"label":string}],"target":{"kind":"constraint"|"preference","field":string,"valueType":"number"|"string"|"boolean"}}]}]}

Rules:
- Only ask for information the prompt or intent does NOT already provide. An "answered" list of attribute slugs is provided; never ask for those.
- The attribute catalog lists decision-critical attributes for this domain with a ready-made question (prompt), explanation (tooltip), answer options, and a deterministic target. Choose the 2-3 most decision-critical attributes from the catalog that are still unanswered for THIS specific prompt, and reuse their prompt/tooltip/options/answerType/target verbatim. You may drop an option that is clearly irrelevant to the user's situation, but do not invent new option values.
- If the catalog is empty or too thin, fill gaps from your own knowledge: generic decision variables (budget ceiling, minimum rating, availability) plus obvious domain-specific ones (for a tent: size or occupancy, season rating, packability; for a bike: terrain or riding style; for a laptop: primary use case; for coffee equipment: workflow or footprint).
- Group questions by clarification type. Return at most 2 groups and at most 2 questions per group.
- Prefer "single" choices whose options encode the resolved answer directly (numbers as plain strings, e.g. "150" or "4").
- For "constraint" targets only use fields: maxPrice, minRating, maxDriveMinutes, availableBy. maxPrice/minRating/maxDriveMinutes must be valueType "number"; availableBy is "string".
- For "preference" targets use a short snake_case field describing the attribute (e.g. "occupancy", "season", "size", "terrain", "use_case") with valueType matching the answer type. Never use fields: context, locallyOrderable, shippingCountry, budgetFocused.
- Every question must have a tooltip explaining why it matters.
- If nothing important is missing, return {"groups":[]}.
- Do not include text outside the JSON object.`

export function buildUserPrompt(input: {
  topic: string
  domainSlug: string
  intent: {
    objective: string
    hardConstraints: Record<string, unknown>
    preferences: Record<string, unknown>
  }
  catalog?: CatalogAttribute[]
  answered?: string[]
}): string {
  const catalogBlock =
    input.catalog && input.catalog.length > 0
      ? `\nAvailable attribute catalog (choose from these when they apply):\n${JSON.stringify(input.catalog)}`
      : ''
  const answeredBlock =
    input.answered && input.answered.length > 0
      ? `\nAlready answered (do NOT ask again): ${input.answered.join(', ')}`
      : ''

  return [
    `User prompt: ${input.topic}`,
    `Domain: ${input.domainSlug}`,
    `Parsed intent: ${JSON.stringify(input.intent)}`,
    catalogBlock,
    answeredBlock,
    '',
    'Generate the stage-gate questions for what is still missing.',
  ].join('\n')
}

export interface GateAdapterConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface GenerateGateAdapter {
  generate(input: {
    topic: string
    domainSlug: string
    intent: {
      objective: string
      hardConstraints: Record<string, unknown>
      preferences: Record<string, unknown>
    }
    catalog?: CatalogAttribute[]
    answered?: string[]
  }): Promise<GeneratedGate>
}

export function createGateAdapter(config: GateAdapterConfig): GenerateGateAdapter {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  return {
    async generate(input) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildUserPrompt(input) },
            ],
          }),
          signal: controller.signal,
        })
        if (!response.ok) throw new LlmProviderError(`http_${response.status}`)

        const parsed = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = parsed.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) {
          throw new LlmProviderError('empty_response')
        }

        let json: unknown
        try {
          json = JSON.parse(content)
        } catch {
          throw new LlmProviderError('invalid_json')
        }

        return sanitizeGate(json)
      } catch (error) {
        if (error instanceof LlmProviderError) throw error
        throw new LlmProviderError('timeout')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}