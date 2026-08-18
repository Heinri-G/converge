import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DEMO_CANDIDATES, DEMO_STEPS } from './demo-data'

const creaseStyles = {
  solid: 'bg-mountain/10 text-mountain',
  fold: 'bg-valley/10 text-valley',
  avoid: 'bg-avoid/10 text-avoid',
} as const

const creaseMarks = {
  solid: '∧',
  fold: '∨',
  avoid: '×',
} as const

export default function DemoScreen() {
  const [stepIndex, setStepIndex] = useState(0)
  const step = DEMO_STEPS[stepIndex] ?? DEMO_STEPS[0]!
  const isFirst = stepIndex === 0
  const isLast = stepIndex === DEMO_STEPS.length - 1

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 pb-[calc(var(--safe-bottom)+5rem)]">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] tracking-[0.22em] text-gold-text uppercase">
            Completed example
          </p>
          <span className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            Demo data
          </span>
        </div>
        <h1 className="max-w-xl text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          One coffee decision, end to end.
        </h1>
        <p className="max-w-prose text-[15px] leading-6 text-muted-foreground">
          Walk through a completed Converge run. Everything here is synthetic fixture data; no
          account, location, or provider call is used.
        </p>
      </header>

      <div className="space-y-2" aria-label="Demo progress">
        <div className="flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          <span>{step.label}</span>
          <span>
            {stepIndex + 1} / {DEMO_STEPS.length}
          </span>
        </div>
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={DEMO_STEPS.length}
          aria-valuenow={stepIndex + 1}
        >
          {DEMO_STEPS.map((item, index) => (
            <span
              key={item.id}
              className={cn('h-1 flex-1 rounded-sm bg-muted', index <= stepIndex && 'bg-primary')}
            />
          ))}
        </div>
      </div>

      <Card className="border border-border py-0 shadow-none">
        <CardHeader className="gap-2 px-5 py-5">
          <CardTitle className="text-xl leading-tight">{step.title}</CardTitle>
          <p className="text-sm leading-5 text-muted-foreground">{step.body}</p>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5">
          {step.id === 'map' && <DemoMapStep />}
          {step.id === 'progress' && <DemoProgressStep />}
          {step.id === 'candidates' && <DemoCandidatesStep />}
          {step.id === 'sentiment' && <DemoSentimentStep />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isFirst}
          onClick={() => setStepIndex((index) => index - 1)}
        >
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        {isLast ? (
          <Button asChild className="min-h-11">
            <Link to="/research">Start your own</Link>
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => setStepIndex((index) => index + 1)}
          >
            Next step
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </section>
  )
}

function DemoMapStep() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Starting point
        </p>
        <p className="mt-2 text-base font-medium">Coffee and espresso at home</p>
        <p className="mt-1 text-sm text-muted-foreground">Synthetic topic · no location attached</p>
      </div>
      <div className="space-y-2">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Answer
        </p>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border border-primary bg-primary/10 px-4 text-sm font-medium">
          <Check aria-hidden="true" className="size-4 text-primary" />
          It can own the counter
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Your focus
        </p>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border border-primary bg-primary/10 px-4 text-sm font-medium">
          <Check aria-hidden="true" className="size-4 text-primary" />
          Enthusiast setup
        </div>
      </div>
    </div>
  )
}

function DemoProgressStep() {
  const phases = [
    'Finding places near you',
    'Collecting listings & reviews',
    'Checking drive times',
    'Summarizing what owners say',
  ]
  return (
    <ol className="space-y-3" aria-label="Completed demo phases">
      {phases.map((phase) => (
        <li key={phase} className="flex min-h-11 items-center gap-3 text-sm">
          <Check aria-hidden="true" className="size-4 text-mountain" />
          <span>{phase}</span>
        </li>
      ))}
    </ol>
  )
}

function DemoCandidatesStep() {
  return (
    <div className="space-y-3">
      {DEMO_CANDIDATES.map((candidate) => (
        <article
          key={candidate.id}
          className={cn(
            'border-t border-border pt-4 first:border-t-0 first:pt-0',
            candidate.crease === 'avoid' && 'ring-1 ring-avoid/30 ring-offset-4 ring-offset-card',
          )}
        >
          <div className="flex items-start gap-3">
            <span className="font-mono text-[10px] text-muted-foreground">{candidate.id}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{candidate.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {candidate.driveMinutes}m · {candidate.rating.toFixed(1)} / 5 · synthetic fixture
              </p>
            </div>
            <span
              className={cn(
                'rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium',
                creaseStyles[candidate.crease],
              )}
            >
              {creaseMarks[candidate.crease]}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}

function DemoSentimentStep() {
  const candidate = DEMO_CANDIDATES[2]!
  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-avoid uppercase">
          Options to avoid
        </p>
        <h2 className="mt-2 text-lg font-semibold">{candidate.name}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{candidate.summary}</p>
      </div>
      <div className="space-y-3 text-sm leading-5">
        <p className="text-mountain">Strengths: {candidate.pros.join(', ')}</p>
        <p className="text-valley">Risks: {candidate.cons.join(', ')}</p>
        <div className="rounded-lg border border-avoid/30 bg-avoid/5 p-3 text-avoid">
          <p className="font-medium">Recurring defects</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {candidate.defects.map((defect) => (
              <li key={defect}>{defect}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        Demo data · no live provider call
      </p>
    </div>
  )
}
