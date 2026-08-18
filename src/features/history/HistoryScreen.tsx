import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClonedSession, listSessions } from '@/lib/db'
import type { SessionResolution, SessionSummary } from '@/lib/types'
import { useGuestSession, useSession } from '@/features/auth/hooks'

type LoadState = 'loading' | 'ready' | 'error'

function formatDomain(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolutionLabel(resolution: SessionResolution, hasReport?: boolean): string {
  switch (resolution) {
    case 'complete':
      return hasReport ? 'Report ready' : 'Questions done'
    case 'fast_tracked':
      return 'Quick results'
    default:
      return 'In progress'
  }
}

function resolutionStyles(resolution: SessionResolution): string {
  switch (resolution) {
    case 'complete':
      return 'border-mountain/40 bg-mountain/10 text-mountain'
    case 'fast_tracked':
      return 'border-gold/40 bg-gold/10 text-gold-text'
    default:
      return 'border-border text-muted-foreground'
  }
}

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function HistoryScreen() {
  const { user } = useSession()
  const guest = useGuestSession()
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    void (async () => {
      try {
        const rows = await listSessions()
        setSessions(rows)
        setLoadState('ready')
      } catch {
        setLoadState('error')
        setError('Your history could not be loaded. Try again in a moment.')
      }
    })()
  }, [user])

  async function refine(session: SessionSummary) {
    const resolution: SessionResolution =
      session.resolution === 'in_progress' ? 'in_progress' : 'complete'
    try {
      const cloned = await createClonedSession(session.id, resolution)
      navigate(`/research?session=${cloned.id}`)
    } catch {
      setError('A refined session could not be started. Try again.')
    }
  }

  async function runAgain(session: SessionSummary) {
    try {
      const cloned = await createClonedSession(session.id, 'complete')
      navigate(`/research?session=${cloned.id}`)
    } catch {
      setError('A new search could not be started. Try again.')
    }
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-8">
      <header className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.22em] text-gold-text uppercase">
          Your research
        </p>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          History, reopened — never re-researched.
        </h1>
        <p className="max-w-prose text-[15px] leading-6 text-muted-foreground">
          Finished reports and in-progress research live here. Open one to re-read it, refine it
          without re-answering, or run it again with the same answers.
        </p>
      </header>

      {!user && guest && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">Local draft on this device</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {formatDomain(guest.session.domain_slug)} ·{' '}
                <span className={resolutionStyles(guest.session.resolution)}>
                  {resolutionLabel(
                    guest.session.resolution,
                    (guest.candidates ?? []).length > 0,
                  )}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="min-h-11">
                <Link to="/report">Open the draft report</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/signin?intent=promote">Save to account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!user && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-3 px-5 py-5">
            <h2 className="text-base font-semibold">History is stored on this device until you sign in.</h2>
            <p className="text-sm leading-5 text-muted-foreground">
              Sign in to keep finished reports across devices and share them with other people.
            </p>
            <Button asChild className="min-h-11">
              <Link to="/signin">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user && loadState === 'loading' && (
        <div className="space-y-3" aria-label="Loading history">
          <div className="h-5 w-40 animate-pulse rounded-sm bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {user && loadState === 'error' && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <p className="text-sm leading-5 text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setLoadState('loading')
                void listSessions()
                  .then((rows) => {
                    setSessions(rows)
                    setLoadState('ready')
                  })
                  .catch(() => setLoadState('error'))
              }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {user && loadState === 'ready' && sessions.length === 0 && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">No research saved yet.</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Finish a search and the report lands here.
              </p>
            </div>
            <Button asChild className="min-h-11">
              <Link to="/research">Start a research</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user && loadState === 'ready' && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="border border-border py-0 shadow-none">
              <CardContent className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">
                      {session.title || formatDomain(session.domain_slug)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDomain(session.domain_slug)}
                      {formatUpdated(session.updated_at) ? ` · ${formatUpdated(session.updated_at)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[11px] tracking-[0.12em] uppercase ${resolutionStyles(session.resolution)}`}
                  >
                    {resolutionLabel(session.resolution)}
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    className="min-h-11 sm:flex-1"
                    disabled={session.resolution === 'in_progress'}
                  >
                    <Link to={`/report?session=${session.id}`}>Open report</Link>
                  </Button>
                  {session.resolution === 'in_progress' && (
                    <Button asChild className="min-h-11 sm:flex-1">
                      <Link to={`/research?session=${session.id}`}>Continue</Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 sm:flex-1"
                    onClick={() => void refine(session)}
                  >
                    Refine
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 sm:flex-1"
                    onClick={() => void runAgain(session)}
                  >
                    Run again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}