import { useContext } from 'react'
import type { SupabaseClient } from '../lib/supabase'
import { SupabaseContext } from './supabase-context'

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseContext)
  if (!client) throw new Error('useSupabase must be used within a SupabaseProvider')
  return client
}
