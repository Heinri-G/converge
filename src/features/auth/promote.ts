import type { User } from '@supabase/supabase-js'
import { clearGuestSession, readGuestSession } from '../../lib/offline'
import { createSession } from '../../lib/db'
import type { ResearchSession } from '../../lib/types'

export async function promoteGuestSession(user: User): Promise<ResearchSession | null> {
  const guest = await readGuestSession()
  if (!guest) return null
  const session = await createSession(user.id, guest.session)
  await clearGuestSession()
  return session
}
