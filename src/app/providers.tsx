import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { SupabaseContext } from './supabase-context'

export function SupabaseProvider({ children }: { children: ReactNode }) {
  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>
}
