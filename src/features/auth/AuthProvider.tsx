import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSupabase } from '../../app/useSupabase'
import { AuthContext } from './session-context'
import type { AuthState } from './session-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase()
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState({
        user: data.session?.user ?? null,
        session: data.session ?? null,
        loading: false,
      })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      })
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(() => state, [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
