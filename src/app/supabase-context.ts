import { createContext } from 'react'
import type { SupabaseClient } from '../lib/supabase'

export const SupabaseContext = createContext<SupabaseClient | null>(null)
