import { z } from 'npm:zod@4.4.3'
import type { RawListing, SentimentAdapter } from './pipeline.ts'

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(`llm: ${message}`)
    this.name = 'LlmProviderError'
  }
}

const LLM_TIMEOUT_MS = 30_000

const listItemSchema = z.string().min(1).max(500)
const listSchema = z.array(listItemSchema).max(20)

export const analysisSchema = z.object({
  sentimentScore: z.number().min(-1).max(1),
  pros: listSchema,
  cons: listSchema,
  defects: listSchema,
  summary: z.string().min(1).max(1000),
})

const SYSTEM_PROMPT = `You are a research analyst. You read collected web text about one candidate option and extract the consensus view. Return ONLY strict JSON with exactly this shape:
{"sentimentScore": number between -1 and 1, "pros": string[], "cons": string[], "defects": string[], "summary": string}
"defects" must capture recurring defect mentions, for example when multiple owners or reviews report the same issue. Every array entry must be a concrete, specific claim. Keep "summary" under 1000 characters. Do not include text outside the JSON object.`

function buildUserPrompt(
  listing: RawListing,
  context: { query: string; domainSlug: string },
): string {
  const lines = [
    `Candidate: ${listing.name}`,
    `Source: ${listing.sourceUrl}`,
    `Research query: ${context.query} (domain ${context.domainSlug})`,
    '',
    'Text to analyze:',
    (listing.text ?? '').slice(0, 6000),
  ]
  return lines.join('\n')
}

export interface SentimentAdapterConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export function createSentimentAdapter(config: SentimentAdapterConfig): SentimentAdapter {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  return {
    async analyze(listing, context) {
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
        if (typeof content !== 'string' || !content.trim())
          throw new LlmProviderError('empty_response')

        let json: unknown
        try {
          json = JSON.parse(content)
        } catch {
          throw new LlmProviderError('invalid_json')
        }

        const result = analysisSchema.safeParse(json)
        if (!result.success) throw new LlmProviderError('invalid_shape')

        return result.data
      } catch (error) {
        if (error instanceof LlmProviderError) throw error
        throw new LlmProviderError('timeout')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
