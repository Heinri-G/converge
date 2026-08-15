import { useContext, useEffect, useState } from 'react'
import { GUEST_SESSION_EVENT, readGuestSession } from '../../lib/offline'
import type { GuestSessionRecord } from '../../lib/types'
import { AuthContext } from './session-context'

export function useSession() {
  return useContext(AuthContext)
}

export function useGuestSession() {
  const { user } = useSession()
  const [guest, setGuest] = useState<GuestSessionRecord | null>(null)

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      void readGuestSession().then((record) => {
        if (!cancelled) setGuest(user ? null : record)
      })
    }

    refresh()
    window.addEventListener(GUEST_SESSION_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(GUEST_SESSION_EVENT, refresh)
    }
  }, [user])

  return guest
}
