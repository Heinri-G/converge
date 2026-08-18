import { z } from 'npm:zod@4.4.3'
import type { RawListing, SpecAttribute } from './pipeline.ts'

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(`llm: ${message}`)
    this.name = 'LlmProviderError'
  }
}

const LLM_TIMEOUT_MS = 30_000

const specValueSchema = z.union([z.string(), z.number().finite(), z.boolean()])
const specRecordSchema = z.record(z.string(), specValueSchema)

function buildSystemPrompt(attributes: SpecAttribute[]): string {
  const attributeList = attributes
    .map((attribute) => `- ${attribute.slug} (${attribute.label}): ${attribute.valueType}`)
    .join('\n')

  return `You are a research analyst. You read collected web text about one candidate option and extract its key specification values.

Return ONLY strict JSON with exactly this shape:
{"specs":{"<attributeSlug>": value}}

Extract ONLY these attributes (slug (label): type):
${attributeList}

Rules:
- Use the exact slugs above as keys.
- Values must match the declared type: "number" for numeric values, "boolean" for yes/no, "string" otherwise.
- If a value is not present in the text, omit that key entirely — never guess or invent.
- Convert rough units when obvious (e.g. "4 person" -> "4"), but keep strings concise.
- Do not include text outside the JSON object.`
}

function buildUserPrompt(listing: RawListing, context: { query: string; domainSlug: string }): string {
  return [
    `Candidate: ${listing.name}`,
    `Source: ${listing.sourceUrl}`,
    `Research query: ${context.query} (domain ${context.domainSlug})`,
    '',
    'Text to analyze:',
    (listing.text ?? '').slice(0, 6000),
  ].join('\n')
}

/** Strips undeclared keys and coerces values to their declared type. */
export function parseSpecs(
  value: unknown,
  attributes: SpecAttribute[],
): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.specs !== 'object' || candidate.specs === null) return null

  const result = specRecordSchema.safeParse(candidate.specs)
  if (!result.success) return null

  const specs: Record<string, string | number | boolean> = {}
  for (const attribute of attributes) {
    const raw = result.data[attribute.slug]
    if (raw === undefined) continue
    if (attribute.valueType === 'number') {
      const numeric = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(numeric)) specs[attribute.slug] = numeric
    } else if (attribute.valueType === 'boolean') {
      if (typeof raw === 'boolean') specs[attribute.slug] = raw
      else if (typeof raw === 'string') {
        if (/^(yes|true|1)$/i.test(raw)) specs[attribute.slug] = true
        else if (/^(no|false|0)$/i.test(raw)) specs[attribute.slug] = false
      }
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      specs[attribute.slug] = raw.trim().slice(0, 200)
    }
  }

  return Object.keys(specs).length > 0 ? specs : null
}

export interface SpecsAdapter {
  extract(
    listing: RawListing,
    attributes: SpecAttribute[],
    context: { query: string; domainSlug: string },
  ): Promise<Record<string, string | number | boolean> | null>
}

export interface SpecsAdapterConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export function createSpecsAdapter(config: SpecsAdapterConfig): SpecsAdapter {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  return {
    async extract(listing, attributes, context) {
      if (attributes.length === 0) return null

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
              { role: 'system', content: buildSystemPrompt(attributes) },
              { role: 'user', content: buildUserPrompt(listing, context) },
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

        return parseSpecs(json, attributes)
      } catch (error) {
        if (error instanceof LlmProviderError) throw error
        throw new LlmProviderError('timeout')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}