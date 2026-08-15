import { supabase } from '@/lib/supabase'
import type { ScrapeRequest, ScrapeResponse } from '@/lib/types'

export async function runScrapeAndAnalyze(input: ScrapeRequest): Promise<ScrapeResponse> {
  const { data, error } = await supabase.functions.invoke('scrape-and-analyze', {
    body: input,
  })

  if (error) throw new Error('The research pipeline could not be reached.')
  if (!data || !Array.isArray(data.candidates) || typeof data.analysis !== 'object') {
    throw new Error('The research pipeline returned an invalid response.')
  }

  return data as ScrapeResponse
}
