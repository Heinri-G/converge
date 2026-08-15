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

export async function updateSessionStageState(
  sessionId: string,
  stageState: Record<string, unknown>,
): Promise<ResearchSession> {
  const { data, error } = await supabase
    .from('research_sessions')
    .update({ stage_state: stageState })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data
}
