import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  loadReport,
  loadResearchSession,
  loadSessionAnalyses,
  loadSessionCandidates,
  saveReport,
} from '@/lib/db'
import { readGuestSession } from '@/lib/offline'
import { isResearchObjective } from '@/lib/research-intent'
import type { AnalysisDraft, CandidateDraft, ReportDraft, ResearchTier } from '@/lib/types'
import { synthesize } from './engine'
import { ComparisonMatrix } from './ComparisonMatrix'
import { TopThree } from './TopThree'
import { AntiPicks } from './AntiPicks'
import { ShareSheet } from '@/features/reports/ShareSheet'

interface GuestAnalysisItem {
  candidateId: string
  sentimentScore: number
  pros: string[]
  cons: string[]
  defects: string[]
  sourceSummary: string
  model: string
}

function isCandidateDraft(value: unknown): value is CandidateDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CandidateDraft>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.sourceUrl === 'string'
  )
}

function isGuestAnalysisItem(value: unknown): value is GuestAnalysisItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<GuestAnalysisItem>
  return (
    typeof item.candidateId === 'string' &&
    typeof item.sentimentScore === 'number' &&
    Array.isArray(item.pros)
  )
}

function toAnalysisRecord(items: unknown[]): Record<string, AnalysisDraft | null> {
  const analysis: Record<string, AnalysisDraft | null> = {}
  for (const item of items) {
    if (!isGuestAnalysisItem(item)) continue
    analysis[item.candidateId] = {
      sentimentScore: item.sentimentScore,
      pros: item.pros,
      cons: Array.isArray(item.cons) ? item.cons : [],
      defects: Array.isArray(item.defects) ? item.defects : [],
      sourceSummary: item.sourceSummary ?? '',
      model: item.model ?? '',
    }
  }
  return analysis
}

function formatTitle(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function searchTypeLabel(tier: ResearchTier): string {
  return tier === 'broad' ? 'Broad search' : 'Focused search'
}

type LoadState = 'loading' | 'ready' | 'error'

interface LoadedReport {
  report: ReportDraft
  reportId: string | null
  saved: boolean
}

export default function ReportScreen() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session') ?? undefined

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [report, setReport] = useState<ReportDraft | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const loaded = sessionId ? await loadSignedInReport(sessionId) : await loadGuestReport()
        if (!active) return
        if (!loaded) {
          setReport(null)
          setReportId(null)
          setLoadState('ready')
          return
        }
        setReport(loaded.report)
        setReportId(loaded.reportId)
        setSaved(loaded.saved)
        setLoadState('ready')
      } catch (loadError) {
        if (!active) return
        setLoadState('error')
        setError(loadError instanceof Error ? loadError.message : 'The report could not be loaded.')
      }
    })()

    return () => {
      active = false
    }
  }, [sessionId])

  async function handleSave() {
    if (!sessionId || !report) return
    try {
      await saveReport(sessionId, report)
      setSaved(true)
    } catch {
      setError('The report could not be saved to your account.')
    }
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-8">
      <header className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">
          Decision report
        </p>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          {report ? report.title : 'Your report is ready.'}
        </h1>
        <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">
          The shortlist, ranked, with the red flags called out. Generated deterministically from
          the same candidates and analysis every time.
        </p>
      </header>

      {loadState === 'loading' && (
        <div className="space-y-3" aria-label="Loading report">
          <div className="h-5 w-44 animate-pulse rounded-sm bg-muted" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {loadState === 'error' && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <p className="text-sm leading-5 text-muted-foreground">{error}</p>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/research">Start a new research</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && !report && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">No report here yet.</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Run a research first, then this screen shows the comparison matrix, Top 3, and the
                options to avoid.
              </p>
            </div>
            <Button asChild className="min-h-11">
              <Link to="/research">Start a research</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && report && (
        <>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-sm border border-border px-2 py-1">
              {searchTypeLabel(report.matrix[0]?.tier ?? 'broad')}
            </span>
            <span className="rounded-sm border border-border px-2 py-1">
              {report.matrix.length} options in the matrix
            </span>
          </div>

          <section className="space-y-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Top 3 recommended options
              </p>
              <h2 className="mt-1 text-lg font-semibold">The strongest three.</h2>
            </div>
            <TopThree options={report.top_3} />
          </section>

          <section className="space-y-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Comparison matrix
              </p>
              <h2 className="mt-1 text-lg font-semibold">The whole shortlist, side by side.</h2>
            </div>
            <ComparisonMatrix rows={report.matrix} />
          </section>

          <section className="space-y-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-avoid uppercase">
                Options to avoid
              </p>
              <h2 className="mt-1 text-lg font-semibold">Anti-Picks, with reasons.</h2>
            </div>
            <AntiPicks picks={report.anti_picks} />
          </section>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {sessionId ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={saved}
                onClick={() => void handleSave()}
              >
                {saved ? 'Saved to your account' : 'Save report'}
              </Button>
            ) : (
              <Button asChild className="min-h-11">
                <Link to="/research">Start a new research</Link>
              </Button>
            )}
            {reportId && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setShareOpen(true)}
              >
                Share
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/">Home</Link>
            </Button>
          </div>
        </>
      )}

      {reportId && (
        <ShareSheet reportId={reportId} open={shareOpen} onOpenChange={setShareOpen} />
      )}
    </section>
  )
}

async function loadGuestReport(): Promise<LoadedReport | null> {
  const guest = await readGuestSession()
  if (!guest) return null

  const candidates = (guest.candidates ?? []).filter(isCandidateDraft)
  if (candidates.length === 0) return null

  const analysis = toAnalysisRecord(guest.analysis ?? [])
  const tier = guest.tier ?? 'entry_espresso'
  const objective = isResearchObjective(guest.session.stage_state.objective)
    ? guest.session.stage_state.objective
    : undefined
  const report = synthesize(
    {
      title: guest.session.title || formatTitle(guest.session.domain_slug),
      tier,
      ...(objective ? { objective } : {}),
    },
    candidates,
    analysis,
  )
  return { report, reportId: null, saved: false }
}

async function loadSignedInReport(sessionId: string): Promise<LoadedReport | null> {
  const existing = await loadReport(sessionId)
  if (existing) {
    const { reportId, ...report } = existing
    return { report, reportId, saved: true }
  }

  const session = await loadResearchSession(sessionId)
  const candidates = await loadSessionCandidates(sessionId)
  if (candidates.length === 0) return null

  const analyses = await loadSessionAnalyses(sessionId)
  const tier: ResearchTier = session.stage_state.fastTracked ? 'broad' : 'entry_espresso'
  const objective = isResearchObjective(session.stage_state.objective)
    ? session.stage_state.objective
    : undefined
  const report = synthesize(
    {
      title: session.title || formatTitle(session.domain_slug),
      tier,
      ...(objective ? { objective } : {}),
    },
    candidates,
    analyses,
  )
  const savedReport = await saveReport(sessionId, report)
  return { report, reportId: savedReport.id, saved: true }
}