import { useNavigate } from 'react-router-dom'
import { LogOutIcon } from 'lucide-react'
import { useSupabase } from '@/app/useSupabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useGuestSession, useSession } from './hooks'

function initialsFor(email: string): string {
  const local = (email.split('@')[0] ?? '').replace(/[^a-z0-9]/gi, '')
  return (local.slice(0, 2) || '?').toUpperCase()
}

export function AccountControl({ className, fullWidth = false }: { className?: string; fullWidth?: boolean }) {
  const supabase = useSupabase()
  const { user, loading } = useSession()
  const guest = useGuestSession()
  const navigate = useNavigate()

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-flex h-11 w-11 items-center justify-center rounded-lg bg-muted', className)}
      />
    )
  }

  if (user) {
    const email = user.email ?? ''
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${email}`}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background ring-1 ring-foreground/20 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
              className,
            )}
          >
            {initialsFor(email)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{email}</span>
            <span className="text-xs font-normal text-muted-foreground">Signed in</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void supabase.auth.signOut()}
          >
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Button
      variant="outline"
      size="lg"
      className={cn('h-11', fullWidth && 'w-full', className)}
      onClick={() => navigate(guest ? '/signin?intent=promote' : '/signin')}
    >
      {guest ? 'Save to account' : 'Sign in'}
    </Button>
  )
}
