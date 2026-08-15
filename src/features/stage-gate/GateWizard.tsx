import { useEffect, useEffectEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { updateSessionStageState } from '@/lib/db'
import { clearGuestSession, readGuestSession, saveGuestSession } from '@/lib/offline'
import type { DomainBranch, GateState } from '@/lib/types'
import { fetchDomainBranches, fetchDomainSlugs, fetchGateQuestions } from './api'
import { MAX_DEPTH, isAtMaxDepth, isComplete, nextBranch } from './flow'
import { QuestionSheet } from './QuestionSheet'

interface GateWizardProps {
  sessionId?: string
  onComplete?: (state: GateState) => void
}

type LoadState = 'loading' | 'ready' | 'error'

function formatDomainSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function persistGuestState(domainSlug: string, state: GateState) {
  const current = await readGuestSession()
  await saveGuestSession(
    current ?? {
      guestId: crypto.randomUUID(),
      session: {
        domain_slug: domainSlug,
        title: '',
        resolution: 'in_progress',
        stage_state: state,
      },
      candidates: [],
      analysis: [],
    },
  )

  if (current) {
    await saveGuestSession({
      ...current,
      session: { ...current.session, stage_state: state },
    })
  }
}

function isGateState(value: unknown): value is GateState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GateState>
  return (
    typeof state.domainSlug === 'string' &&
    Array.isArray(state.branchPath) &&
    typeof state.answers === 'object' &&
    state.answers !== null
  )
}

export function GateWizard({ sessionId, onComplete }: GateWizardProps) {
  const [catalogState, setCatalogState] = useState<LoadState>('loading')
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [branches, setBranches] = useState<DomainBranch[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [gateState, setGateState] = useState<GateState | null>(null)
  const [question, setQuestion] = useState<
    Awaited<ReturnType<typeof fetchGateQuestions>>[number] | null
  >(null)
  const [questionState, setQuestionState] = useState<LoadState>('ready')
  const [mobileOpen, setMobileOpen] = useState(true)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadDomains() {
    setCatalogState('loading')
    setError(null)

    try {
      const availableDomains = await fetchDomainSlugs()
      setDomains(availableDomains)
      setCatalogState('ready')
    } catch {
      setCatalogState('error')
      setError(
        'The domain catalog could not be reached. Check the database migration, then try again.',
      )
    }
  }

  const resumeGuestSession = useEffectEvent(async () => {
    if (sessionId) return

    const guest = await readGuestSession()
    const snapshot = guest?.session.stage_state
    if (!isGateState(snapshot)) return

    const loadedBranches = await fetchDomainBranches(snapshot.domainSlug)
    const root = loadedBranches.find((branch) => branch.parentId === null)
    if (!root) return

    const currentBranchId = snapshot.branchPath.at(-1) ?? root.id
    const currentQuestions = await fetchGateQuestions(currentBranchId)

    setSelectedDomain(snapshot.domainSlug)
    setBranches(loadedBranches)
    setActiveBranchId(currentBranchId)
    setGateState(snapshot)
    setQuestion(currentQuestions[0] ?? null)
    setQuestionState('ready')

    if (isComplete(snapshot) || currentQuestions.length === 0) {
      setComplete(true)
      setMobileOpen(false)
    }
  })

  useEffect(() => {
    let active = true

    void fetchDomainSlugs()
      .then((availableDomains) => {
        if (!active) return
        setDomains(availableDomains)
        setCatalogState('ready')
        void resumeGuestSession().catch(() => undefined)
      })
      .catch(() => {
        if (!active) return
        setCatalogState('error')
        setError(
          'The domain catalog could not be reached. Check the database migration, then try again.',
        )
      })

    return () => {
      active = false
    }
  }, [])

  async function selectDomain(domainSlug: string) {
    setSelectedDomain(domainSlug)
    setQuestionState('loading')
    setError(null)
    setComplete(false)
    setMobileOpen(true)

    try {
      const loadedBranches = await fetchDomainBranches(domainSlug)
      const root = loadedBranches.find((branch) => branch.parentId === null)
      if (!root) throw new Error('Domain has no root branch')

      const rootQuestions = await fetchGateQuestions(root.id)
      setBranches(loadedBranches)
      setActiveBranchId(root.id)
      setGateState({ domainSlug, branchPath: [], answers: {} })
      setQuestion(rootQuestions[0] ?? null)
      setQuestionState(rootQuestions.length > 0 ? 'ready' : 'error')
      if (rootQuestions.length === 0) {
        setError('This domain has no gate questions yet.')
      }
    } catch {
      setQuestionState('error')
      setError('This domain could not be opened. Try again in a moment.')
    }
  }

  async function saveState(nextState: GateState) {
    if (sessionId) {
      await updateSessionStageState(sessionId, nextState)
      return
    }

    await persistGuestState(nextState.domainSlug, nextState)
  }

  async function answerQuestion(answer: string | boolean) {
    if (!gateState || !question || !activeBranchId || !selectedDomain) return

    setQuestionState('loading')
    setError(null)
    const nextState = nextBranch(gateState, question, answer)

    try {
      await saveState(nextState)
      setGateState(nextState)

      const nextBranchId = nextState.branchPath.at(-1)
      if (isAtMaxDepth(nextState) || !nextBranchId || nextBranchId === activeBranchId) {
        setQuestion(null)
        setComplete(true)
        setQuestionState('ready')
        setMobileOpen(false)
        onComplete?.(nextState)
        return
      }

      const nextQuestions = await fetchGateQuestions(nextBranchId)
      setActiveBranchId(nextBranchId)
      setQuestion(nextQuestions[0] ?? null)
      setQuestionState('ready')

      if (nextQuestions.length === 0) {
        setComplete(true)
        setMobileOpen(false)
        onComplete?.(nextState)
      }
    } catch {
      setQuestionState('error')
      setError('Your answer could not be saved. Try again.')
    }
  }

  function resetDomain() {
    setSelectedDomain(null)
    setBranches([])
    setActiveBranchId(null)
    setGateState(null)
    setQuestion(null)
    setComplete(false)
    setError(null)
    setQuestionState('ready')
    void clearGuestSession()
  }

  const activeBranch = branches.find((branch) => branch.id === activeBranchId)
  const mappedBranch = gateState?.branchPath
    .map((branchId) => branches.find((branch) => branch.id === branchId))
    .filter((branch): branch is DomainBranch => Boolean(branch))
    .at(-1)

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-8">
      <header className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          Stage gate 1
        </p>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          Fold the question before you chase the answer.
        </h1>
        <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">
          Start with the variable that changes the decision. Converge will keep the path short and
          leave the rabbit hole behind.
        </p>
      </header>

      {catalogState === 'loading' && (
        <div className="space-y-3" aria-label="Loading domains">
          <div className="h-5 w-40 animate-pulse rounded-sm bg-muted" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {catalogState === 'error' && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">The catalog is folded away.</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void loadDomains()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {catalogState === 'ready' && !selectedDomain && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Choose a domain to map.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The catalog supplies the tiers and questions. Nothing is baked into this screen.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {domains.map((domain) => (
              <Button
                key={domain}
                type="button"
                variant="outline"
                className="h-auto min-h-16 justify-between whitespace-normal px-4 py-3 text-left"
                onClick={() => void selectDomain(domain)}
              >
                <span>
                  <span className="block font-medium">{formatDomainSlug(domain)}</span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    Open the adaptive map
                  </span>
                </span>
                <span aria-hidden="true" className="font-mono text-xs text-primary">
                  →
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {selectedDomain && branches.length > 0 && (
        <section aria-label="Available tiers" className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Tier sequence
          </p>
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <span
                key={branch.id}
                className={`rounded-sm border px-2 py-1 text-sm ${
                  branch.id === activeBranchId
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {branch.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {selectedDomain && questionState === 'loading' && (
        <div className="space-y-3" aria-label="Loading gate question">
          <div className="h-4 w-32 animate-pulse rounded-sm bg-muted" />
          <div className="h-52 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {selectedDomain && questionState === 'error' && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <p className="text-sm leading-5 text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={resetDomain}>
              Choose another domain
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedDomain &&
        question &&
        activeBranch &&
        gateState &&
        !complete &&
        questionState === 'ready' && (
          <QuestionSheet
            question={question}
            branch={activeBranch}
            branchPathLength={Math.min(MAX_DEPTH, gateState.branchPath.length)}
            maxDepth={MAX_DEPTH}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
            onAnswer={(answer) => void answerQuestion(answer)}
          />
        )}

      {complete && gateState && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-6 px-5 py-6">
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-[0.18em] text-primary uppercase">
                Map ready
              </p>
              <h2 className="text-xl leading-tight font-semibold tracking-tight">
                A useful fold is ready for {formatDomainSlug(selectedDomain ?? '')}.
              </h2>
              <p className="text-sm leading-5 text-muted-foreground">
                The next research step can use this narrowed path instead of restarting from the
                whole domain.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Selected tier
              </p>
              <p className="mt-2 text-base font-medium">
                {mappedBranch?.label ?? 'Starting point'}
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {mappedBranch?.description ?? 'Your answers are saved with this guest session.'}
              </p>
            </div>
            <Button type="button" variant="outline" className="min-h-11" onClick={resetDomain}>
              Map another path
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
