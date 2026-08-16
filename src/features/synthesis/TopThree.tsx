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
          className="flex gap-4 rounded-lg border border-border bg-card p-4 shadow-seam"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary font-mono text-sm font-medium text-primary"
          >
            {option.rank}
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