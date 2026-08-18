import type { RankedOption } from '@/lib/types'

export function TopThree({ options }: { options: RankedOption[] }) {
  if (options.length === 0) {
    return (
      <p className="text-sm leading-5 text-muted-foreground">
        No ranked options yet — candidate analysis is missing for this search.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {options.map((option) => (
        <article
          key={option.candidateId}
          className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-seam"
        >
          <span className="rounded-sm bg-mountain/10 px-1.5 py-1 font-mono text-[11px] font-medium tracking-[0.12em] text-mountain uppercase">
            Top-{option.rank}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{option.name}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{option.reason}</p>
          </div>
        </article>
      ))}
    </div>
  )
}