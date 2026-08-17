import { supabase } from '@/lib/supabase'
import type { GeneratedGate } from '@/lib/types'
import type { ResearchIntent } from '@/lib/research-intent'

const GATE_FUNCTION_TIMEOUT_MS = 45_000

export interface GenerateGateInput {
  topic: string
  domainSlug: string
  intent: {
    objective: ResearchIntent['objective']
    hardConstraints: ResearchIntent['hardConstraints']
    preferences: ResearchIntent['preferences']
  }
}

export async function generateGate(input: GenerateGateInput): Promise<GeneratedGate> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GATE_FUNCTION_TIMEOUT_MS)

  try {
    const { data, error } = await supabase.functions.invoke('generate-gate', {
      body: input,
      signal: controller.signal,
    } as Record<string, unknown>)

    if (error) throw new Error('The question generator could not be reached.')
    if (!data || !Array.isArray(data.groups)) {
      throw new Error('The question generator returned an invalid response.')
    }

    return data as GeneratedGate
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Preparing questions timed out — try again.', { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export { applyGateAnswers, parseGeneratedGate } from './gateAnswers'