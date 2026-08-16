import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { updateSessionResolution, loadResearchSession } from '@/lib/db'
import { clearGuestSession, readGuestSession, saveGuestSession } from '@/lib/offline'
import { deriveResearchIntent, type ResearchIntent } from '@/lib/research-intent'
import type { DomainBranch, GateState, SessionResolution } from '@/lib/types'
import { ResearchRun } from '@/features/research/ResearchRun'
import { fetchDomainBranches, fetchDomainSlugs, fetchGateQuestions } from './api'
import { createFallbackGate } from './fallback'
import { clampGateState, MAX_DEPTH, isAtMaxDepth, isComplete, nextBranch } from './flow'
import { createFastTrackedState } from './fastTrack'
import { QuestionSheet } from './QuestionSheet'

interface GateWizardProps {
  sessionId?: string
  onComplete?: (state: GateState) => void
  initialPrompt?: string
  fastTrack?: boolean
}

type LoadState = 'loading' | 'ready' | 'error'

function formatDomainSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function persistGuestState(
  domainSlug: string,
  state: GateState,
  resolution: SessionResolution,
) {
  const current = await readGuestSession()
  await saveGuestSession(
    current ?? {
      guestId: crypto.randomUUID(),
      session: {
        domain_slug: domainSlug,
        title: '',
        resolution,
        stage_state: state,
      },
      candidates: [],
      analysis: [],
    },
  )

  if (current) {
    await saveGuestSession({
      ...current,
      session: { ...current.session, resolution, stage_state: state },
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

export function GateWizard({
  sessionId,
  onComplete,
  initialPrompt,
  fastTrack = false,
}: GateWizardProps) {
  const [intent, setIntent] = useState<ResearchIntent>(() =>
    deriveResearchIntent(initialPrompt ?? 'Coffee and espresso at home'),
  )
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

  const selectPromptDomain = useCallback(() => {
    const fallback = createFallbackGate(intent)
    const nextState = fastTrack
      ? {
          ...fallback.state,
          branchPath: [fallback.state.branchPath[0]!, fallback.branches[1]!.id],
          fastTracked: true,
        }
      : fallback.state
    setSelectedDomain(intent.domain)
    setBranches(fallback.branches)
    setActiveBranchId(fallback.branches[0]?.id ?? null)
    setGateState(nextState)
    setQuestion(fastTrack ? null : fallback.question)
    setQuestionState('ready')
    setComplete(fastTrack)
    setMobileOpen(!fastTrack)
  }, [fastTrack, intent])

  async function loadDomains() {
    setCatalogState('loading')
    setError(null)

    try {
      const availableDomains = await fetchDomainSlugs()
      setDomains(availableDomains)
      setCatalogState('ready')
    } catch {
      if (initialPrompt) {
        setDomains([])
        setCatalogState('ready')
        if (fastTrack) selectPromptDomain()
      } else {
        setCatalogState('error')
        setError(
          'The domain catalog could not be reached. Check the database migration, then try again.',
        )
      }
    }
  }

  async function resumeSnapshot(snapshot: GateState, resolution: SessionResolution) {
    const normalizedSnapshot = clampGateState(snapshot)

    if (normalizedSnapshot.fastTracked || resolution === 'fast_tracked') {
      setSelectedDomain(normalizedSnapshot.domainSlug)
      setGateState({ ...normalizedSnapshot, fastTracked: true })
      setComplete(true)
      setQuestion(null)
      setQuestionState('ready')
      setMobileOpen(false)
      return
    }

    const loadedBranches = await fetchDomainBranches(normalizedSnapshot.domainSlug)
    const root = loadedBranches.find((branch) => branch.parentId === null)
    if (!root) return

    setSelectedDomain(normalizedSnapshot.domainSlug)
    setBranches(loadedBranches)
    setGateState(normalizedSnapshot)

    if (resolution === 'complete') {
      setComplete(true)
      setQuestion(null)
      setQuestionState('ready')
      setMobileOpen(false)
      return
    }

    const currentBranchId = normalizedSnapshot.branchPath.at(-1) ?? root.id
    const currentQuestions = await fetchGateQuestions(currentBranchId)

    setActiveBranchId(currentBranchId)
    setQuestion(currentQuestions[0] ?? null)
    setQuestionState('ready')

    if (isComplete(normalizedSnapshot) || currentQuestions.length === 0) {
      setComplete(true)
      setMobileOpen(false)
    }
  }

  const resumeGuestSession = useEffectEvent(async () => {
    if (sessionId || initialPrompt) return

    const guest = await readGuestSession()
    const snapshot = guest?.session.stage_state
    if (!isGateState(snapshot)) return

    await resumeSnapshot(snapshot, guest!.session.resolution)
  })

  const resumeSignedInSession = useEffectEvent(async (id: string) => {
    const session = await loadResearchSession(id)
    if (!isGateState(session.stage_state)) return

    await resumeSnapshot(session.stage_state, session.resolution)
  })

  const resumeFromPrompt = useEffectEvent(async (availableDomains: string[]) => {
    if (fastTrack) {
      selectPromptDomain()
      return
    }
    if (availableDomains.includes(intent.domain)) {
      await selectDomain(intent.domain)
    }
  })

  useEffect(() => {
    let active = true

    void fetchDomainSlugs()
      .then((availableDomains) => {
        if (!active) return
        setDomains(availableDomains)
        setCatalogState('ready')
        if (sessionId) {
          void resumeSignedInSession(sessionId).catch(() => undefined)
        } else if (initialPrompt) {
          void resumeFromPrompt(availableDomains)
        } else {
          void resumeGuestSession().catch(() => undefined)
        }
      })
      .catch(() => {
        if (!active) return
        if (sessionId) {
          setCatalogState('error')
          setError('Your saved session could not be reached. Check your connection and try again.')
        } else if (initialPrompt) {
          setDomains([])
          setCatalogState('ready')
          if (fastTrack) selectPromptDomain()
        } else {
          setCatalogState('error')
          setError(
            'The domain catalog could not be reached. Check the database migration, then try again.',
          )
        }
      })

    return () => {
      active = false
    }
  }, [fastTrack, initialPrompt, selectPromptDomain, sessionId])

  async function selectDomain(domainSlug: string) {
    setIntent((current) =>
      current.domain === domainSlug ? current : deriveResearchIntent(current.topic, domainSlug),
    )
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
      const fastTrackBranch = loadedBranches[1] ?? root
      setBranches(loadedBranches)
      setActiveBranchId(fastTrack ? fastTrackBranch.id : root.id)
      setGateState(
        fastTrack
          ? { domainSlug, branchPath: [root.id, fastTrackBranch.id], answers: {}, fastTracked: true }
          : { domainSlug, branchPath: [], answers: {} },
      )
      setQuestion(fastTrack ? null : (rootQuestions[0] ?? null))
      setComplete(fastTrack)
      setMobileOpen(!fastTrack)
      setQuestionState(fastTrack || rootQuestions.length > 0 ? 'ready' : 'error')
      if (!fastTrack && rootQuestions.length === 0) {
        setError('This domain has no gate questions yet.')
      }
    } catch {
      setQuestionState('error')
      setError('This domain could not be opened. Try again in a moment.')
    }
  }

  async function saveState(
    nextState: GateState,
    resolution: SessionResolution = 'in_progress',
  ) {
    if (sessionId) {
      await updateSessionResolution(sessionId, resolution, nextState)
      return
    }

    await persistGuestState(nextState.domainSlug, nextState, resolution)
  }

  async function fastTrackGate() {
    if (!gateState) return
    const nextState = createFastTrackedState(gateState)
    try {
      await saveState(nextState, 'fast_tracked')
      setGateState(nextState)
      setQuestion(null)
      setComplete(true)
      setQuestionState('ready')
      setMobileOpen(false)
      onComplete?.(nextState)
    } catch {
      setQuestionState('error')
      setError("That couldn't be saved. Try again.")
    }
  }

  async function answerQuestion(answer: string | boolean) {
    if (!gateState || !question || !activeBranchId || !selectedDomain) return

    setQuestionState('loading')
    setError(null)
    const nextState = nextBranch(gateState, question, answer)

    try {
      await saveState(nextState, 'in_progress')
      setGateState(nextState)

      const nextBranchId = nextState.branchPath.at(-1)
      const descendsToNext =
        Boolean(nextBranchId) && nextBranchId !== activeBranchId && !isAtMaxDepth(nextState)

      if (descendsToNext && nextBranchId) {
        const nextQuestions = await fetchGateQuestions(nextBranchId)
        setActiveBranchId(nextBranchId)
        const nextQuestion = nextQuestions[0]
        if (nextQuestion) {
          setQuestion(nextQuestion)
          setQuestionState('ready')
          return
        }
      }

      await saveState(nextState, 'complete')
      setQuestion(null)
      setComplete(true)
      setQuestionState('ready')
      setMobileOpen(false)
      onComplete?.(nextState)
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
          A few quick questions
        </p>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          Answer a couple of quick questions — get a focused shortlist.
        </h1>
        <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">
          Each question targets what changes the outcome most. No rabbit holes.
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
              <h2 className="text-base font-semibold">We couldn't load the categories.</h2>
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
            <h2 className="text-base font-semibold">What are you comparing?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a category, or use the one matched to your request.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {initialPrompt && !domains.includes(intent.domain) && (
              <Button
                type="button"
                variant="default"
                className="h-auto min-h-16 justify-between whitespace-normal px-4 py-3 text-left sm:col-span-2"
                onClick={selectPromptDomain}
              >
                <span>
                  <span className="block font-medium">Use {formatDomainSlug(intent.domain)}</span>
                  <span className="mt-1 block text-sm font-normal text-primary-foreground/75">
                    Matched from your request: {intent.topic}
                  </span>
                </span>
                <span aria-hidden="true" className="font-mono text-xs">
                  →
                </span>
              </Button>
            )}
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
                    Open {formatDomainSlug(domain)}
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
            answered={Math.min(MAX_DEPTH, Object.keys(gateState.answers).length)}
            maxDepth={MAX_DEPTH}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
            onAnswer={(answer) => void answerQuestion(answer)}
            onFastTrack={() => void fastTrackGate()}
          />
        )}

      {complete && gateState && (
        <ResearchRun
          domainSlug={selectedDomain ?? gateState.domainSlug}
          tier={gateState.fastTracked ? 'broad' : mappedBranch?.tier ?? 'capsule'}
          intent={{ ...intent, domain: selectedDomain ?? intent.domain }}
        />
      )}
    </section>
  )
}
