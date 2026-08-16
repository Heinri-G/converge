import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSharedReport } from '@/lib/db'
import type { ReportDraft } from '@/lib/types'
import { ComparisonMatrix } from '@/features/synthesis/ComparisonMatrix'
import { TopThree } from '@/features/synthesis/TopThree'
import { AntiPicks } from '@/features/synthesis/AntiPicks'

type LoadState = 'loading' | 'ready' | 'unavailable'

export default function SharedReportScreen() {
  const { token } = useParams<{ token: string }>()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [report, setReport] = useState<ReportDraft | null>(null)
  const unavailable = !token || loadState === 'unavailable'

  useEffect(() => {
    if (!token) return

    void (async () => {
      try {
        const payload = await getSharedReport(token)
        setReport(payload.report)
        setLoadState('ready')
      } catch {
        setLoadState('unavailable')
      }
    })()
  }, [token])

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-8">
      {loadState === 'loading' && (
        <div className="space-y-3" aria-label="Loading shared report">
          <div className="h-5 w-44 animate-pulse rounded-sm bg-muted" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {unavailable && (
        <Card className="border border-border py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-5">
            <div>
              <h1 className="text-xl leading-tight font-semibold">This report isn't available.</h1>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                The link may be invalid or the share was revoked.
              </p>
            </div>
            <Button asChild className="min-h-11">
              <Link to="/">Back to Converge</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && report && (
        <>
          <header className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">
                Shared report
              </p>
              <span className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                Read only
              </span>
            </div>
            <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
              {report.title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">
              A decision-ready shortlist shared by the author — the matrix, the Top 3, and the
              options to avoid.
            </p>
          </header>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-sm border border-border px-2 py-1">
              {report.matrix[0]?.tier === 'broad' ? 'Broad search' : 'Focused search'}
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

          <div className="pt-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/">Start your own research</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  )
}