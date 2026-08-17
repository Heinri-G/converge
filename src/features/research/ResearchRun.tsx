import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  buildSearchQuery,
  countryName,
  localShopHint,
  objectiveLabel,
  SHIPPING_COUNTRY_CODES,
  type ResearchIntent,
  type ResearchObjective,
  type SearchContext,
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

function analysisFor(result: ScrapeResponse, candidateId: string): AnalysisDraft | null {
  return result.analysis[candidateId] ?? null
}

function parseBudget(
  value: string,
  existingCurrency?: string,
): { maxPrice: number; currency?: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const currency = /€/.test(trimmed)
    ? 'EUR'
    : /£/.test(trimmed)
      ? 'GBP'
      : /\$/.test(trimmed)
        ? 'USD'
        : existingCurrency
  const digits = trimmed.replace(/[€£$\s,]/g, '').replace(/eur|gbp|usd/i, '')
  const num = Number(digits)
  if (!Number.isFinite(num) || num <= 0) return null
  return currency ? { maxPrice: num, currency } : { maxPrice: num }
}

const OBJECTIVES: Array<{ value: ResearchObjective; label: string }> = [
  { value: 'best_overall', label: 'Best overall fit' },
  { value: 'best_value', label: 'Best value for money' },
  { value: 'lowest_cost', label: 'Lowest cost' },
  { value: 'closest', label: 'Closest option' },
  { value: 'highest_quality', label: 'Highest quality' },
  { value: 'lowest_risk', label: 'Lowest risk' },
]

const RADIUS_PRESETS = [15, 30, 45, 60, 90, 120]

function radiusOptions(current: number): number[] {
  return RADIUS_PRESETS.includes(current)
    ? RADIUS_PRESETS
    : [current, ...RADIUS_PRESETS].sort((a, b) => a - b)
}

export function ResearchRun({ domainSlug, tier, intent, sessionId }: ResearchRunProps) {
  const [objective, setObjective] = useState<ResearchObjective>(intent.objective)
  const [editingObjective, setEditingObjective] = useState(false)
  const [context, setContext] = useState<SearchContext>(
    intent.preferences.context === 'place' ? 'place' : 'product',
  )
  const [locallyOrderable, setLocallyOrderable] = useState(
    intent.preferences.context === 'product' &&
      intent.preferences.locallyOrderable !== false,
  )
  const [shippingCountry, setShippingCountry] = useState<string | undefined>(
    typeof intent.preferences.shippingCountry === 'string'
      ? intent.preferences.shippingCountry
      : undefined,
  )
  const [address, setAddress] = useState(intent.location?.address ?? '')
  const [useGeo, setUseGeo] = useState(
    Boolean(intent.location?.address || intent.hardConstraints.maxDriveMinutes),
  )
  const [radiusMinutes, setRadiusMinutes] = useState(
    String(intent.hardConstraints.maxDriveMinutes ?? 30),
  )
  const [budgetInput, setBudgetInput] = useState('')
  const [phase, setPhase] = useState<ResearchPhase | 'cancelled' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScrapeResponse | null>(null)
  const runId = useRef(0)

  const budgetConstraint = useMemo(
    () => parseBudget(budgetInput, intent.hardConstraints.currency),
    [budgetInput, intent.hardConstraints.currency],
  )
  const effectiveMaxPrice = intent.hardConstraints.maxPrice ?? budgetConstraint?.maxPrice
  const effectiveCurrency = intent.hardConstraints.currency ?? budgetConstraint?.currency
  const wantsBudget =
    (objective === 'best_value' || objective === 'lowest_cost') &&
    intent.hardConstraints.maxPrice === undefined
  const hasRequirements =
    intent.hardConstraints.maxPrice !== undefined ||
    intent.hardConstraints.minRating !== undefined ||
    intent.hardConstraints.maxDriveMinutes !== undefined ||
    budgetConstraint !== null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentRun = runId.current + 1
    runId.current = currentRun
    setError(null)
    setResult(null)
    setPhase('geocoding')

    const query = buildSearchQuery(intent.topic, domainSlug, objective, {
      context,
      useGeo,
      address,
      radiusMinutes: Number(radiusMinutes),
      locallyOrderable,
      ...(shippingCountry ? { shippingCountry } : {}),
      preferences: intent.preferences,
    })

    const hardConstraints = budgetConstraint
      ? { ...intent.hardConstraints, ...budgetConstraint }
      : intent.hardConstraints

    const input: ScrapeRequest = {
      query: query.slice(0, 200),
      domainSlug,
      intent: { ...intent, objective, hardConstraints },
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

  function toggleContext() {
    setContext((current) => {
      const next = current === 'place' ? 'product' : 'place'
      if (next === 'product' && objective === 'closest') setObjective('best_overall')
      return next
    })
  }

  const objectives = OBJECTIVES.filter(
    (option) => context !== 'product' || option.value !== 'closest',
  )

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
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-0 rounded-sm px-2 py-1 text-sm font-normal"
                onClick={toggleContext}
              >
                {context === 'place' ? 'Places to visit' : 'Product to buy'}
              </Button>
              {context === 'product' && locallyOrderable && (
                <label className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-1">
                  <span className="text-xs">Orderable in</span>
                  <select
                    aria-label="Orderable country"
                    className="bg-transparent text-sm font-medium text-foreground outline-none"
                    value={shippingCountry ?? ''}
                    onChange={(event) => setShippingCountry(event.target.value || undefined)}
                  >
                    <option value="">Your region</option>
                    {SHIPPING_COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {countryName(code)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {effectiveMaxPrice !== undefined && (
                <span className="rounded-sm border border-border px-2 py-1">
                  Under {effectiveCurrency ? `${effectiveCurrency} ` : ''}
                  {effectiveMaxPrice}
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
              <div className="space-y-2">
                <span className="text-sm font-medium">Objective</span>
                {editingObjective ? (
                  <div className="space-y-2">
                    <select
                      id="research-objective"
                      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={objective}
                      onChange={(event) => setObjective(event.target.value as ResearchObjective)}
                    >
                      {objectives.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 w-full text-muted-foreground"
                      onClick={() => setEditingObjective(false)}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex min-h-11 w-full items-center justify-between px-4"
                    onClick={() => setEditingObjective(true)}
                  >
                    <span>{objectiveLabel(objective)}</span>
                    <span className="font-mono text-xs text-muted-foreground">Edit</span>
                  </Button>
                )}
              </div>

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
                      {radiusOptions(Number(radiusMinutes)).map((value) => (
                        <option key={value} value={value}>
                          {value} minutes
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : context === 'place' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() => setUseGeo(true)}
                >
                  Add a drive-time boundary
                </Button>
              ) : (
                <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={locallyOrderable}
                    onChange={(event) => setLocallyOrderable(event.target.checked)}
                    aria-label="Prefer locally orderable items"
                  />
                  <span className="text-sm leading-5">
                    <span className="font-medium">Prefer locally orderable items</span>
                    <span className="block text-muted-foreground">
                      {shippingCountry
                        ? `Favour options you can order in ${countryName(shippingCountry)} — ${localShopHint(shippingCountry)}.`
                        : `Favour options you can order locally — ${localShopHint()}.`}
                    </span>
                  </span>
                </label>
              )}
              {wantsBudget && (
                <label className="block space-y-2 text-sm font-medium" htmlFor="research-budget">
                  Max budget (optional)
                  <Input
                    id="research-budget"
                    className="h-11 text-base"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 300 or €250"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    A ceiling we filter for — you said you care about value, so this focuses the
                    shortlist.
                  </span>
                </label>
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
        <ProgressScreen
          phase={phase}
          error={error}
          onCancel={cancel}
          context={context}
          hasRequirements={hasRequirements}
        />
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
