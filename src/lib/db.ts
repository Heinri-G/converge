import { supabase } from './supabase'
import type { ResearchSession, SessionDraft } from './types'

export async function createSession(
  ownerId: string,
  input: SessionDraft,
): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .insert({ owner_id: ownerId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}
