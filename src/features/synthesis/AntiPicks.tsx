import { cn } from '@/lib/utils'
import type { AntiPick } from '@/lib/types'

const redFlagStyles = {
  defects: 'bg-avoid/10 text-avoid',
  overhyped: 'bg-valley/10 text-valley',
} as const

const redFlagLabel = {
  defects: 'Defects',
  overhyped: 'Overhyped',
} as const

export function AntiPicks({ picks }: { picks: AntiPick[] }) {
  if (picks.length === 0) {
    return (
      <p className="text-sm leading-5 text-muted-foreground">
        No options to avoid in this pull.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {picks.map((pick) => (
        <article
          key={pick.candidateId}
          className="space-y-2 border-l-2 border-avoid/50 pl-4"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.12em] uppercase',
                redFlagStyles[pick.redFlag],
              )}
            >
              {redFlagLabel[pick.redFlag]}
            </span>
            <h3 className="text-base font-semibold">{pick.name}</h3>
          </div>
          <p className="text-sm leading-5 text-muted-foreground">{pick.reason}</p>
        </article>
      ))}
    </div>
  )
}