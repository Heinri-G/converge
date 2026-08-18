import { Info } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  text: string
}

export function Tooltip({ text }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const panelWidth = Math.min(288, window.innerWidth - 48)
    const left = Math.max(
      16,
      Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 16),
    )
    setPosition({ left, top: rect.bottom + 8 })
    const onScroll = () => setOpen(false)
    const onResize = () => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
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
      {open &&
        position &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="fixed z-[60] w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-border bg-card p-3 text-left text-sm leading-5 text-card-foreground shadow-seam"
            style={{ left: position.left, top: position.top }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
