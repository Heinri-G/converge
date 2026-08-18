import { supabase } from '@/lib/supabase'
import type { GeneratedGate } from '@/lib/types'

/**
 * Persists a generated gate as a `source='generated'` domain catalog so later
 * sessions (and guests) reuse it without an LLM call. Best-effort: a failure
 * here only means the next session regenerates.
 */
export async function promoteCatalog(domainSlug: string, gate: GeneratedGate): Promise<void> {
  if (gate.groups.length === 0) return

  try {
    const { error } = await supabase.functions.invoke('promote-catalog', {
      body: { domainSlug, gate },
    })
    if (error) throw new Error('catalog promotion failed')
  } catch {
    // Promotion is best-effort and non-blocking.
  }
}