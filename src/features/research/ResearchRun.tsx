import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  objectiveLabel,
  type ResearchIntent,
  type ResearchObjective,
} from '@/lib/research-intent'
import type { AnalysisDraft, ResearchTier, ScrapeRequest, ScrapeResponse } from '@/lib/types'
import { ProgressScreen } from './ProgressScreen'
import { runResearch, type ResearchPhase } from './runResearch'

interface ResearchRunProps {
  domainSlug: string
  tier: ResearchTier
  intent: ResearchIntent
  sessionId?: string
}

function displayDomain(slug: string): string {
  return slug.split('-').join(' ')
}

function analysisFor(result: ScrapeResponse, candidateId: string): AnalysisDraft | null {
  return result.analysis[candidateId] ?? null
}

const OBJECTIVES: Array<{ value: ResearchObjective; label: string }> = [
  { value: 'best_overall', label: 'Best overall fit' },
  { value: 'best_value', label: 'Best value for money' },
  { value: 'lowest_cost', label: 'Lowest cost' },
  { value: 'closest', label: 'Closest option' },
  { value: 'highest_quality', label: 'Highest quality' },
  { value: 'lowest_risk', label: 'Lowest risk' },
]

export function ResearchRun({ domainSlug, tier, intent, sessionId }: ResearchRunProps) {
  const [objective, setObjective] = useState<ResearchObjective>(intent.objective)
  const [address, setAddress] = useState(intent.location?.address ?? '')
  const [useGeo, setUseGeo] = useState(
    Boolean(intent.location?.address || intent.hardConstraints.maxDriveMinutes),
  )
  const [radiusMinutes, setRadiusMinutes] = useState(
    String(intent.hardConstraints.maxDriveMinutes ?? 30),
  )
  const [phase, setPhase] = useState<ResearchPhase | 'cancelled' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScrapeResponse | null>(null)
  const runId = useRef(0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentRun = runId.current + 1
    runId.current = currentRun
    setError(null)
    setResult(null)
    setPhase('geocoding')

    const input: ScrapeRequest = {
      query: `${displayDomain(domainSlug)} ${objectiveLabel(objective)}`.trim(),
      domainSlug,
      intent: { ...intent, objective },
      tier,
      maxResults: 10,
    }
    if (useGeo) {
      input.geo = { address: address.trim() }
      input.radiusMinutes = Number(radiusMinutes)
    }

    try {
      const runOptions: Parameters<typeof runResearch>[0] = {
        input,
        onPhase: (nextPhase) => {
          if (currentRun === runId.current) setPhase(nextPhase)
        },
      }
      if (sessionId) runOptions.sessionId = sessionId
      const nextResult = await runResearch(runOptions)
      if (currentRun !== runId.current) return
      setResult(nextResult)
      setPhase('complete')
    } catch (runError) {
      if (currentRun !== runId.current) return
      setError(runError instanceof Error ? runError.message : 'The search failed.')
      setPhase('error')
    }
  }

  function cancel() {
    runId.current += 1
    setPhase('cancelled')
  }

  return (
    <div className="space-y-6">
      {!phase || phase === 'cancelled' || phase === 'error' || phase === 'complete' ? (
        <Card className="border border-border py-0 shadow-none">
          <CardHeader className="gap-2 px-5 py-5">
            <p className="font-mono text-[10px] tracking-[0.18em] text-primary uppercase">
              Your search
            </p>
            <CardTitle className="text-xl leading-tight">Ready to search.</CardTitle>
            <p className="text-sm leading-5 text-muted-foreground">
              Check what Converge understood — you can adjust anything before the search starts.
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {intent.hardConstraints.maxPrice !== undefined && (
                <span className="rounded-sm border border-border px-2 py-1">
                  Under{' '}
                  {intent.hardConstraints.currency ? `${intent.hardConstraints.currency} ` : ''}
                  {intent.hardConstraints.maxPrice}
                </span>
              )}
              {intent.hardConstraints.minRating !== undefined && (
                <span className="rounded-sm border border-border px-2 py-1">
                  {intent.hardConstraints.minRating}+ rating
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <label className="block space-y-2 text-sm font-medium" htmlFor="research-objective">
                What matters most
                <select
                  id="research-objective"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value as ResearchObjective)}
                >
                  {OBJECTIVES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {useGeo ? (
                <>
                  <label className="block space-y-2 text-sm font-medium" htmlFor="research-address">
                    Search from
                    <Input
                      id="research-address"
                      className="h-11 text-base"
                      placeholder="Address or neighborhood"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium" htmlFor="research-radius">
                    Drive-time radius
                    <select
                      id="research-radius"
                      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={radiusMinutes}
                      onChange={(event) => setRadiusMinutes(event.target.value)}
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </label>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() => setUseGeo(true)}
                >
                  Add a drive-time boundary
                </Button>
              )}
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={useGeo && !address.trim()}
              >
                Find my options
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {phase && phase !== 'complete' && (
        <ProgressScreen phase={phase} error={error} onCancel={cancel} />
      )}

      {phase === 'complete' && result && (
        <Card className="border border-border py-0 shadow-none">
          <CardHeader className="gap-2 px-5 py-5">
            <p className="font-mono text-[10px] tracking-[0.18em] text-primary uppercase">
              Results
            </p>
            <CardTitle className="text-xl leading-tight">
              {result.candidates.length} options matched your setup.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {result.candidates.length === 0 ? (
              <p className="text-sm leading-5 text-muted-foreground">
                Nothing came back — try a broader prompt or loosen the radius.
              </p>
            ) : (
              result.candidates.map((candidate) => {
                const analysis = analysisFor(result, candidate.id)
                return (
                  <article
                    key={candidate.id}
                    className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold">{candidate.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {candidate.source}
                          {candidate.geo.driveMinutes === undefined
                            ? ''
                            : ` · ${candidate.geo.driveMinutes} min away`}
                        </p>
                      </div>
                      {candidate.rating !== null && (
                        <span className="font-mono text-xs">{candidate.rating.toFixed(1)} / 5</span>
                      )}
                    </div>
                    <p className="mt-2 break-all text-sm text-muted-foreground">
                      {candidate.sourceUrl}
                    </p>
                    {candidate.hardConstraintStatus === 'unknown' && (
                      <p className="mt-2 text-sm text-valley">
                        We couldn't confirm this option meets your constraint — treat it as
                        unverified.
                      </p>
                    )}
                    {analysis && (
                      <div className="mt-3 space-y-2 text-sm leading-5">
                        <p>{analysis.sourceSummary}</p>
                        {analysis.pros.length > 0 && (
                          <p className="text-mountain">Strengths: {analysis.pros.join(', ')}</p>
                        )}
                        {analysis.cons.length > 0 && (
                          <p className="text-valley">Risks: {analysis.cons.join(', ')}</p>
                        )}
                        {analysis.defects.length > 0 && (
                          <p className="text-avoid">
                            Recurring defects: {analysis.defects.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </CardContent>
          <div className="border-t border-border px-5 py-4">
            <Button asChild className="min-h-11 w-full">
              <Link to="/report">See the full report</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
