import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { updateSessionResolution, loadResearchSession } from '@/lib/db'
import { clearGuestSession, readGuestSession, saveGuestSession } from '@/lib/offline'
import { deriveResearchIntent, displayDomain, type ResearchIntent } from '@/lib/research-intent'
import type { DomainBranch, GateAnswer, GateState, GeneratedGate, SessionResolution } from '@/lib/types'
import { ResearchRun } from '@/features/research/ResearchRun'
import { fetchDomainBranches, fetchDomainSlugs, fetchGateQuestions } from './api'
import { createFallbackGate, fallbackObjectiveFromBranch } from './fallback'
import { clampGateState, MAX_DEPTH, isAtMaxDepth, isComplete, nextBranch } from './flow'
import { createFastTrackedState } from './fastTrack'
import { applyGateAnswers, generateGate, parseGeneratedGate } from './generateGate'
import { GroupSheet } from './GroupSheet'
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
  title?: string,
) {
  const current = await readGuestSession()
  await saveGuestSession(
    current ?? {
      guestId: crypto.randomUUID(),
      session: {
        domain_slug: domainSlug,
        title: title ?? '',
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
      session: {
        ...current.session,
        title: current.session.title || title || '',
        resolution,
        stage_state: state,
      },
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

function groupAllAnswered(group: GeneratedGate['groups'][number], answers: Record<string, GateAnswer>): boolean {
  return group.questions.every((question) => answers[question.id] !== undefined)
}

function resumeGroupIndex(gate: GeneratedGate, answers: Record<string, GateAnswer>): number {
  const index = gate.groups.findIndex((group) => !groupAllAnswered(group, answers))
  return index === -1 ? Math.max(0, gate.groups.length - 1) : index
}

export function GateWizard({
  sessionId,
  onComplete,
  initialPrompt,
  fastTrack = false,
}: GateWizardProps) {
  const [intent, setIntent] = useState<ResearchIntent>(() =>
    deriveResearchIntent(initialPrompt ?? 'Coffee and espresso at home', undefined, {
      locale: navigator.language,
    }),
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
  const [generatedGate, setGeneratedGate] = useState<GeneratedGate | null>(null)
  const [groupIndex, setGroupIndex] = useState(0)
  const [generationState, setGenerationState] = useState<LoadState>('ready')

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
    setComplete(fastTrack || fallback.question === null)
    setMobileOpen(!fastTrack)

    if (fastTrack || fallback.question === null) {
      const resolution: SessionResolution = fastTrack ? 'fast_tracked' : 'complete'
      void persistGuestState(intent.domain, nextState, resolution, intent.topic)
    }
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
        selectPromptDomain()
      } else {
        setCatalogState('error')
        setError(
          'The domain catalog could not be reached. Check the database migration, then try again.',
        )
      }
    }
  }

  async function beginGeneratedGate(baseIntent: ResearchIntent) {
    setGenerationState('loading')
    setError(null)
    try {
      const gate = await generateGate({
        topic: baseIntent.topic,
        domainSlug: baseIntent.domain,
        intent: {
          objective: baseIntent.objective,
          hardConstraints: baseIntent.hardConstraints,
          preferences: baseIntent.preferences,
        },
      })
      setGeneratedGate(gate)
      setGenerationState('ready')
      setGateState({
        domainSlug: baseIntent.domain,
        branchPath: [],
        answers: {},
        generatedGate: gate,
      })
      if (gate.groups.length === 0) {
        setComplete(true)
        setMobileOpen(false)
      } else {
        setGroupIndex(0)
        setMobileOpen(true)
      }
    } catch {
      setGenerationState('ready')
      selectFallbackFromIntent(baseIntent)
    }
  }

  function selectFallbackFromIntent(baseIntent: ResearchIntent) {
    const fallback = createFallbackGate(baseIntent)
    setIntent(baseIntent)
    setSelectedDomain(baseIntent.domain)
    setBranches(fallback.branches)
    setActiveBranchId(fallback.branches[0]?.id ?? null)
    setGateState(fallback.state)
    setQuestion(fallback.question)
    setQuestionState('ready')
    setComplete(fallback.question === null)
    setMobileOpen(fallback.question !== null)
  }

  async function resumeGeneratedGate(
    gate: GeneratedGate,
    snapshot: GateState,
    baseIntent: ResearchIntent,
  ) {
    setIntent(baseIntent)
    setSelectedDomain(baseIntent.domain)
    setGateState(snapshot)
    setGeneratedGate(gate)
    setGenerationState('ready')

    const allAnswered = gate.groups.every((group) => groupAllAnswered(group, snapshot.answers))
    if (allAnswered) {
      setComplete(true)
      setMobileOpen(false)
    } else {
      setGroupIndex(resumeGroupIndex(gate, snapshot.answers))
      setMobileOpen(true)
    }
  }

  async function resumeSnapshot(snapshot: GateState, resolution: SessionResolution, sessionTitle: string) {
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

    const baseIntent = deriveResearchIntent(
      sessionTitle || displayDomain(normalizedSnapshot.domainSlug),
      normalizedSnapshot.domainSlug,
      { locale: navigator.language },
    )
    setIntent(baseIntent)

    const parsedGate = parseGeneratedGate(normalizedSnapshot.generatedGate)
    if (parsedGate) {
      await resumeGeneratedGate(parsedGate, normalizedSnapshot, baseIntent)
      return
    }

    const loadedBranches = await fetchDomainBranches(normalizedSnapshot.domainSlug)
    const root = loadedBranches.find((branch) => branch.parentId === null)

    if (!root && Object.keys(normalizedSnapshot.answers).length > 0) {
      setSelectedDomain(normalizedSnapshot.domainSlug)
      setGateState(normalizedSnapshot)
      setComplete(true)
      setQuestion(null)
      setQuestionState('ready')
      setMobileOpen(false)
      return
    }

    if (!root) {
      await beginGeneratedGate(baseIntent)
      return
    }

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

    await resumeSnapshot(snapshot, guest!.session.resolution, guest!.session.title)
  })

  const resumeSignedInSession = useEffectEvent(async (id: string) => {
    const session = await loadResearchSession(id)
    if (!isGateState(session.stage_state)) return

    await resumeSnapshot(session.stage_state, session.resolution, session.title)
  })

  const resumeFromPrompt = useEffectEvent(async (availableDomains: string[]) => {
    if (availableDomains.includes(intent.domain)) {
      await selectDomain(intent.domain)
    } else {
      selectPromptDomain()
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
          void resumeSignedInSession(sessionId).catch(() => {
            setCatalogState('error')
            setError('Your saved session could not be reached. Check your connection and try again.')
          })
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
          selectPromptDomain()
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
      current.domain === domainSlug
        ? current
        : deriveResearchIntent(current.topic, domainSlug, { locale: navigator.language }),
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
      const nextState: GateState = fastTrack
        ? { domainSlug, branchPath: [root.id, fastTrackBranch.id], answers: {}, fastTracked: true }
        : { domainSlug, branchPath: [], answers: {} }
      setBranches(loadedBranches)
      setActiveBranchId(fastTrack ? fastTrackBranch.id : root.id)
      setGateState(nextState)
      setQuestion(fastTrack ? null : (rootQuestions[0] ?? null))
      setComplete(fastTrack)
      setMobileOpen(!fastTrack)
      setQuestionState(fastTrack || rootQuestions.length > 0 ? 'ready' : 'error')
      if (!fastTrack && rootQuestions.length === 0) {
        setError('This domain has no gate questions yet.')
      }
      if (fastTrack) {
        void persistGuestState(domainSlug, nextState, 'fast_tracked', intent.topic)
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

    await persistGuestState(nextState.domainSlug, nextState, resolution, intent.topic)
  }

  async function fastTrackGate() {
    if (!gateState) return
    const nextState = createFastTrackedState(gateState)
    try {
      await saveState(nextState, 'fast_tracked')
      setGateState(nextState)
      setQuestion(null)
      setGeneratedGate(null)
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

  function answerGenerated(questionId: string, answer: GateAnswer) {
    if (!gateState) return
    const nextState = {
      ...gateState,
      answers: { ...gateState.answers, [questionId]: answer },
    }
    setGateState(nextState)
    void saveState(nextState, 'in_progress').catch(() => undefined)
  }

  function advanceGroup() {
    if (!gateState || !generatedGate) return
    const nextIndex = groupIndex + 1
    if (nextIndex >= generatedGate.groups.length) {
      const finalState = { ...gateState, answers: { ...gateState.answers } }
      void saveState(finalState, 'complete')
        .then(() => {
          setComplete(true)
          setMobileOpen(false)
          onComplete?.(finalState)
        })
        .catch(() => {
          setQuestionState('error')
          setError('Your answers could not be saved. Try again.')
        })
    } else {
      setGroupIndex(nextIndex)
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
    setGeneratedGate(null)
    setGroupIndex(0)
    setMobileOpen(true)
    void clearGuestSession()
  }

  function startFresh() {
    resetDomain()
    if (initialPrompt) {
      if (domains.includes(intent.domain)) {
        void selectDomain(intent.domain)
      } else {
        selectPromptDomain()
      }
    }
  }

  const activeBranch = branches.find((branch) => branch.id === activeBranchId)
  const mappedBranch = gateState?.branchPath
    .map((branchId) => branches.find((branch) => branch.id === branchId))
    .filter((branch): branch is DomainBranch => Boolean(branch))
    .at(-1)

  const mergedIntent: ResearchIntent | null = (() => {
    if (!gateState) return null
    if (generatedGate) {
      return applyGateAnswers(intent, generatedGate, gateState.answers)
    }
    const fallbackObjective = Object.values(gateState.answers).reduce((acc, answer) => {
      if (typeof answer !== 'string') return acc
      return { ...acc, ...fallbackObjectiveFromBranch(answer) }
    }, {})
    return { ...intent, ...fallbackObjective }
  })()

  const runTier =
    gateState?.fastTracked === true ? 'broad' : (mappedBranch?.tier ?? 'entry_espresso')

  const currentGroup =
    generatedGate && groupIndex < generatedGate.groups.length
      ? generatedGate.groups[groupIndex]
      : null

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-8">
      <header className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          {sessionId ? 'Refining your research' : 'A few quick questions'}
        </p>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          {generationState === 'loading'
            ? 'Preparing your questions…'
            : 'Answer a couple of quick questions — get a focused shortlist.'}
        </h1>
        <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">
          {generationState === 'loading'
            ? 'Reading your request to find what matters most.'
            : 'Each question targets what changes the outcome most. No rabbit holes.'}
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

      {catalogState === 'ready' && !selectedDomain && !sessionId && (
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

      {sessionId && generationState === 'loading' && (
        <div className="space-y-3" aria-label="Preparing questions">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {selectedDomain && questionState === 'loading' && !sessionId && (
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

      {currentGroup && gateState && !complete && generationState === 'ready' && (
        <GroupSheet
          group={currentGroup}
          groupIndex={groupIndex}
          totalGroups={generatedGate!.groups.length}
          answers={gateState.answers}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          onAnswer={answerGenerated}
          onContinue={() => advanceGroup()}
          onFastTrack={() => void fastTrackGate()}
          {...(sessionId ? {} : { onStartFresh: startFresh })}
        />
      )}

      {selectedDomain &&
        question &&
        activeBranch &&
        gateState &&
        !complete &&
        questionState === 'ready' &&
        !currentGroup && (
          <QuestionSheet
            question={question}
            answered={Math.min(MAX_DEPTH, Object.keys(gateState.answers).length)}
            maxDepth={MAX_DEPTH}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
            onAnswer={(answer) => void answerQuestion(answer)}
            onFastTrack={() => void fastTrackGate()}
            {...(sessionId ? {} : { onStartFresh: startFresh })}
          />
        )}

      {complete && gateState && mergedIntent && (
        <ResearchRun
          domainSlug={selectedDomain ?? gateState.domainSlug}
          tier={runTier}
          intent={mergedIntent}
          {...(sessionId ? { sessionId } : {})}
        />
      )}
    </section>
  )
}