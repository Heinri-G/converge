import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { History, House, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof House
  end: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/research', label: 'Research', icon: Search, end: false },
  { to: '/history', label: 'History', icon: History, end: false },
]

function navLinkClasses(isActive: boolean, mobile: boolean) {
  return cn(
    'flex items-center gap-2 rounded-md font-semibold text-muted-foreground transition-colors',
    mobile
      ? 'flex-1 flex-col justify-center gap-0.5 text-[11px]'
      : 'px-3 py-2 text-sm',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'hover:bg-muted hover:text-foreground',
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] lg:grid-cols-[var(--side-nav-w)_1fr] lg:grid-rows-1">
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 pt-[calc(var(--safe-top)+12px)] pb-3 lg:hidden">
        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-gold" />
        <p className="m-0 text-lg font-semibold tracking-tight">Converge</p>
      </header>

      <main className="overflow-y-auto px-4 pt-4 lg:col-start-2 lg:row-start-1 lg:px-6 lg:pt-6">
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="flex gap-1 border-t border-border bg-background px-2 pt-1 pb-[calc(var(--safe-bottom)+4px)] lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navLinkClasses(isActive, true)}
          >
            <item.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <nav
        aria-label="Primary"
        className="hidden flex-col gap-1 border-r border-border bg-background p-4 pt-[calc(var(--safe-top)+16px)] lg:col-start-1 lg:row-start-1 lg:flex"
      >
        <p className="mb-4 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-gold" />
          Converge
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navLinkClasses(isActive, false)}
          >
            <item.icon aria-hidden="true" className="size-4.5" strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
