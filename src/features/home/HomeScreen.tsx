import { Input } from '@/components/ui/input'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

interface Crease {
  id: string
  name: string
  meta: string
  crease: 'solid' | 'fold' | 'avoid'
}

const CREASES: Crease[] = [
  { id: 'BRV-01', name: 'Breville Bambino Plus', meta: '15m · $449', crease: 'solid' },
  { id: 'DFL-04', name: 'DeLonghi Dedica', meta: '15m · $329', crease: 'fold' },
  { id: 'GCM-02', name: 'Gaggia Classic Pro', meta: '20m · $399', crease: 'avoid' },
]

const creaseStyles = {
  solid: 'bg-mountain/10 text-mountain',
  fold: 'bg-valley/10 text-valley',
  avoid: 'bg-avoid/10 text-avoid',
} as const

const creaseGlyph = {
  solid: '∧',
  fold: '∨',
  avoid: '×',
} as const

export default function HomeScreen() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')

  function deploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt.trim()) return
    navigate(`/research?prompt=${encodeURIComponent(prompt.trim())}`)
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="font-mono text-[11px] font-medium tracking-[0.22em] text-gold uppercase">
          Start a research
        </p>
        <h1 className="mt-2.5 text-[1.7rem] leading-tight font-semibold tracking-tight text-balance">
          Research, without the rabbit hole.
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Converge folds a question into a shortlist worth deciding on.
        </p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={deploy}>
        <Input
          aria-label="What are you choosing?"
          placeholder="Best espresso machine under $600"
          className="h-11"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="flex gap-3">
          <Button type="submit" size="lg" className="flex-1">
            Deploy research
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              if (prompt.trim())
                navigate(`/research?prompt=${encodeURIComponent(prompt.trim())}&fastTrack=1`)
            }}
          >
            Fast Track
          </Button>
        </div>
      </form>

      <Button asChild variant="outline" className="min-h-11 w-full">
        <Link to="/demo">See a completed example</Link>
      </Button>

      <div>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Crease field
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {CREASES.map((item) => (
            <li key={item.id}>
              <Card
                size="sm"
                className={cn(
                  'flex-row items-center gap-3 py-0 ring-1',
                  item.crease === 'avoid' ? 'ring-avoid/30' : 'ring-foreground/8',
                )}
              >
                <span className="px-3.5 font-mono text-[10px] text-muted-foreground">
                  {item.id}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{item.meta}</p>
                </div>
                <span
                  className={cn(
                    'mr-3.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium',
                    creaseStyles[item.crease],
                  )}
                >
                  {creaseGlyph[item.crease]}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
