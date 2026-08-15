import { Info } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  text: string
}

export function Tooltip({ text }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={id}
        onClick={() => setOpen((current) => !current)}
      >
        <Info aria-hidden="true" className="size-4" />
        <span className="sr-only">Why this matters</span>
      </button>
      <span
        id={id}
        className={cn(
          open
            ? 'pointer-events-none absolute top-12 right-0 z-10 block w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-border bg-card p-3 text-left text-sm leading-5 text-card-foreground shadow-seam'
            : 'sr-only',
        )}
      >
        {text}
      </span>
    </span>
  )
}
