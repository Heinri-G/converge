interface ProgressProps {
  value: number
  label: string
}

export function Progress({ value, label }: ProgressProps) {
  const boundedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="space-y-2" aria-label={label}>
      <div className="flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        <span>{label}</span>
        <span>{Math.round(boundedValue)}%</span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(boundedValue)}
      >
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${boundedValue}%` }}
        />
      </div>
    </div>
  )
}
