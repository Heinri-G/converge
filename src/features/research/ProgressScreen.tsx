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

export function ProgressScreen({
  phase,
  error,
  onCancel,
  context,
  hasRequirements = true,
}: ProgressScreenProps) {
  const isProduct = context === 'product'
  const visiblePhases = isProduct && !hasRequirements
    ? phases.filter((item) => item.id !== 'filtering')
    : phases
  const activeIndex = visiblePhases.findIndex((item) => item.id === phase)
  const complete = phase === 'complete'

  return (
    <Card className="sticky bottom-2 z-20 border border-border py-0 shadow-none md:mx-auto md:max-w-xl">
      <CardHeader className="gap-2 px-5 py-5">
        <CardTitle className="text-base">
          {phase === 'error'
            ? 'The search stopped.'
            : phase === 'cancelled'
              ? 'The search was cancelled.'
              : complete
                ? 'The search finished.'
                : 'Converge is working.'}
        </CardTitle>
        <p className="text-sm leading-5 text-muted-foreground">
          {error ??
            (isProduct
              ? 'Searching reviews and shops, focused on your setup.'
              : 'Searching listings, reviews, and forums, focused on your setup.')}
        </p>
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
        {!complete && (
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onCancel}>
            Stop
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
