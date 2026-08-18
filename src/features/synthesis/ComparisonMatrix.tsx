import { cn } from '@/lib/utils'
import type { MatrixRow } from '@/lib/types'

function sentimentLabel(value: number | null): string {
  if (value === null) return 'n/a'
  return value.toFixed(1)
}

function scoreLabel(value: number | null): string {
  if (value === null) return 'n/a'
  return value.toFixed(2)
}

function driveLabel(minutes: number | null): string {
  return minutes === null ? 'n/a' : `${minutes} min`
}

function ratingLabel(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(1)} / 5`
}

function bandLabel(band: MatrixRow['priceBand']): string {
  if (band === null) return 'n/a'
  return band
}

function specLabel(key: string): string {
  return key.split('_').join(' ')
}

function specValue(value: string | number | boolean | null): string {
  if (value === null) return 'n/a'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function RowLine({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn('text-right font-mono text-xs', className)}>{value}</span>
    </div>
  )
}

function CompositeScore({ value }: { value: number | null }) {
  if (value === null) return null
  return (
    <div className="space-y-1">
      <RowLine label="Composite" value={scoreLabel(value)} className="font-medium" />
      <div
        className="h-1 overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-label={`Composite score ${value.toFixed(2)}`}
      >
        <div className="h-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  )
}

function MatrixCard({ row }: { row: MatrixRow }) {
  return (
    <article className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-base font-semibold">{row.name}</h3>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.sourceUrl}</p>
      </div>
      <div className="space-y-1.5">
        <RowLine label="Drive" value={driveLabel(row.driveMinutes)} />
        <RowLine label="Rating" value={ratingLabel(row.rating)} />
        <RowLine label="Sentiment" value={sentimentLabel(row.sentimentScore)} />
        <RowLine label="Price band" value={bandLabel(row.priceBand)} />
        {Object.entries(row.specs).map(([key, value]) => (
          <RowLine key={key} label={specLabel(key)} value={specValue(value)} />
        ))}
        <RowLine
          label="Pros · Cons · Defects"
          value={`${row.prosCount} · ${row.consCount} · ${row.defectsCount}`}
        />
        <CompositeScore value={row.compositeScore} />
      </div>
    </article>
  )
}

function specColumns(rows: MatrixRow[]): string[] {
  const seen: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row.specs)) {
      if (!seen.includes(key)) seen.push(key)
    }
  }
  return seen
}

export function ComparisonMatrix({ rows }: { rows: MatrixRow[] }) {
  const columns = specColumns(rows)

  return (
    <section aria-label="Comparison matrix">
      <div className="md:hidden">
        <div className="divide-y-0 space-y-4">
          {rows.map((row) => (
            <MatrixCard key={row.candidateId} row={row} />
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              <th scope="col" className="py-2 pr-4 font-medium">
                Option
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Drive
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Rating
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Sentiment
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Price
              </th>
              {columns.map((key) => (
                <th key={key} scope="col" className="py-2 pr-4 font-medium">
                  {specLabel(key)}
                </th>
              ))}
              <th scope="col" className="py-2 pr-4 font-medium">
                P · C · D
              </th>
              <th scope="col" className="py-2 font-medium">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.candidateId} className="border-b border-border last:border-b-0">
                <td className="py-3 pr-4 align-top">
                  <p className="font-medium">{row.name}</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                    {row.sourceUrl}
                  </p>
                </td>
                <td className="py-3 pr-4 align-top font-mono text-xs">
                  {driveLabel(row.driveMinutes)}
                </td>
                <td className="py-3 pr-4 align-top font-mono text-xs">
                  {ratingLabel(row.rating)}
                </td>
                <td className="py-3 pr-4 align-top font-mono text-xs">
                  {sentimentLabel(row.sentimentScore)}
                </td>
                <td className="py-3 pr-4 align-top font-mono text-xs">
                  {bandLabel(row.priceBand)}
                </td>
                {columns.map((key) => (
                  <td key={key} className="py-3 pr-4 align-top font-mono text-xs">
                    {specValue(row.specs[key] ?? null)}
                  </td>
                ))}
                <td className="py-3 pr-4 align-top font-mono text-xs">
                  {row.prosCount} · {row.consCount} · {row.defectsCount}
                </td>
                <td className="py-3 align-top">
                  <div className="space-y-1">
                    <p className="font-mono text-xs">{scoreLabel(row.compositeScore)}</p>
                    {row.compositeScore !== null && (
                      <div
                        className="h-1 w-20 overflow-hidden rounded-sm bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={row.compositeScore}
                        aria-label={`Composite score ${row.compositeScore.toFixed(2)}`}
                      >
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round(row.compositeScore * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}