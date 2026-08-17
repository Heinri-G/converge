import { supabase } from '@/lib/supabase'
import type { ScrapeRequest, ScrapeResponse } from '@/lib/types'

const EDGE_FUNCTION_TIMEOUT_MS = 90_000

export async function runScrapeAndAnalyze(input: ScrapeRequest): Promise<ScrapeResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS)

  try {
    const { data, error } = await supabase.functions.invoke('scrape-and-analyze', {
      body: input,
      signal: controller.signal,
    } as Record<string, unknown>)

    if (error) throw new Error('The research pipeline could not be reached.')
    if (!data || !Array.isArray(data.candidates) || typeof data.analysis !== 'object') {
      throw new Error('The research pipeline returned an invalid response.')
    }

    return data as ScrapeResponse
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The search timed out — try a simpler query or a wider radius.', {
        cause: error,
      })
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
