import { useEffect, useState } from 'react'
import { Check, Circle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SearchContext } from '@/lib/research-intent'
import type { ResearchPhase } from './runResearch'

interface ProgressScreenProps {
  phase: ResearchPhase | 'cancelled' | 'error'
  error?: string | null
  onCancel: () => void
  context?: SearchContext
  hasRequirements?: boolean
  topic?: string
}

const phases: Array<{
  id: ResearchPhase
  placeLabel: string
  productLabel: string
}> = [
  { id: 'geocoding', placeLabel: 'Finding places near you', productLabel: 'Finding matching options' },
  { id: 'filtering', placeLabel: 'Checking drive times', productLabel: 'Checking availability & requirements' },
  { id: 'analyzing', placeLabel: 'Summarizing what owners say', productLabel: 'Summarizing what owners say' },
]

const SLOW_HINT_AFTER_MS = 60_000

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ProgressScreen({
  phase,
  error,
  onCancel,
  context,
  hasRequirements = true,
  topic,
}: ProgressScreenProps) {
  const isProduct = context === 'product'
  const visiblePhases = isProduct && !hasRequirements
    ? phases.filter((item) => item.id !== 'filtering')
    : phases
  const activeIndex = visiblePhases.findIndex((item) => item.id === phase)
  const complete = phase === 'complete'
  const stopped = phase === 'error' || phase === 'cancelled'
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const title =
    phase === 'error'
      ? 'The search stopped.'
      : phase === 'cancelled'
        ? 'The search was cancelled.'
        : complete
          ? 'The search finished.'
          : 'Converge is working.'
  const description =
    error ??
    (isProduct
      ? 'Searching reviews and shops, focused on your setup.'
      : 'Searching listings, reviews, and forums, focused on your setup.')
  const slow = !stopped && elapsedSeconds >= SLOW_HINT_AFTER_MS / 1000

  return (
    <Card className="sticky bottom-2 z-20 border border-border border-t-2 border-t-primary py-0 shadow-none md:mx-auto md:max-w-xl">
      {topic && (
        <p className="px-5 pt-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Research · {topic}
        </p>
      )}
      <CardHeader className="gap-2 px-5 py-5">
        <div role="status" aria-live="polite">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        {!stopped && !complete && (
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Elapsed {formatElapsed(elapsedSeconds)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5">
        <ol className="space-y-3" aria-label="Research progress">
          {visiblePhases.map((item, index) => {
            const done = complete || (activeIndex >= 0 && index < activeIndex)
            const active = !complete && item.id === phase
            return (
              <li key={item.id} className="flex min-h-11 items-center gap-3 text-sm">
                {done ? (
                  <Check aria-hidden="true" className="size-4 text-mountain" />
                ) : active ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
                ) : (
                  <Circle aria-hidden="true" className="size-4 text-muted-foreground" />
                )}
                <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {isProduct ? item.productLabel : item.placeLabel}
                </span>
              </li>
            )
          })}
        </ol>
        {slow && (
          <div className="space-y-2">
            <p className="text-sm leading-5 text-muted-foreground">
              Taking longer than usual — you can keep waiting, or stop and try a broader search.
            </p>
          </div>
        )}
        {!complete && (
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onCancel}>
            Stop
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
