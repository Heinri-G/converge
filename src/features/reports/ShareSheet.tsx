import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Copy, Link2, Mail, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { ShareRow } from '@/lib/types'
import { createPublicLink, grantUser, listSharesForReport, revokeShare } from './share'

interface ShareSheetProps {
  reportId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ShareList({
  shares,
  onRevoke,
}: {
  shares: ShareRow[]
  onRevoke: (shareId: string) => void
}) {
  if (shares.length === 0) {
    return <p className="text-sm text-muted-foreground">No shares yet.</p>
  }

  return (
    <ul className="space-y-2" aria-label="Active shares">
      {shares.map((share) => (
        <li key={share.id} className="flex min-h-11 items-center gap-3 text-sm">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border"
          >
            {share.share_type === 'public_link' ? (
              <Link2 className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            {share.share_type === 'public_link' ? 'Public link' : 'Shared with a user'}
            {share.revoked_at ? ' (revoked)' : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
            aria-label="Revoke share"
            onClick={() => onRevoke(share.id)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function ShareSheet({ reportId, open, onOpenChange }: ShareSheetProps) {
  const [shares, setShares] = useState<ShareRow[]>([])
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      const rows = await listSharesForReport(reportId)
      setShares(rows)
      setError(null)
    } catch {
      setError('Your shares could not be loaded.')
    }
  }

  useEffect(() => {
    if (!open) return

    void (async () => {
      const rows = await listSharesForReport(reportId)
      setShares(rows)
      setError(null)
    })().catch(() => setError('Your shares could not be loaded.'))
  }, [open, reportId])

  async function handleCopyLink() {
    setError(null)
    try {
      const path = await createPublicLink(reportId)
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      await refresh()
    } catch {
      setError('A share link could not be created.')
    }
  }

  async function handleGrant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    try {
      await grantUser(reportId, trimmed)
      setEmail('')
      await refresh()
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : 'That share could not be created.')
    }
  }

  async function handleRevoke(shareId: string) {
    setError(null)
    try {
      await revokeShare(shareId)
      await refresh()
    } catch {
      setError('That share could not be revoked.')
    }
  }

  const body = (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Anyone with the link</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => void handleCopyLink()}
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4 text-mountain" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? 'Link copied' : 'Copy public link'}
          </Button>
        </div>
      </div>

      <form className="space-y-2" onSubmit={(event) => void handleGrant(event)}>
        <label className="block space-y-2 text-sm font-medium" htmlFor="share-email">
          Share with a specific user
          <Input
            id="share-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="friend@example.com"
            className="h-11 text-base"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 w-full"
          disabled={!email.trim()}
        >
          Grant access
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Active shares
        </p>
        <ShareList shares={shares} onRevoke={(shareId) => void handleRevoke(shareId)} />
      </div>
    </div>
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton
          overlayClassName="md:hidden"
          className="max-h-[calc(100dvh-4.5rem)] flex-col gap-0 overflow-hidden rounded-t-xl border-border bg-card px-4 pt-5 pb-[calc(var(--safe-bottom)+1rem)] md:hidden"
        >
          <SheetHeader className="px-0 pb-5 pr-12">
            <SheetTitle>Share this report</SheetTitle>
            <SheetDescription>Send the report, not the research.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        </SheetContent>
      </Sheet>

      {open && (
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center bg-black/10 p-4 md:flex"
          role="dialog"
          aria-modal="true"
          aria-label="Share this report"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-seam">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Share this report</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send the report, not the research.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="min-h-11 min-w-11"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                ×
              </Button>
            </div>
            {body}
          </div>
        </div>
      )}
    </>
  )
}