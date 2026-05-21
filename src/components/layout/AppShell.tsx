'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, StickyNote, Activity, Settings } from 'lucide-react'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { t } from '@/lib/i18n/it'

const SIDEBAR_ITEMS = [
  { href: '/admin', label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
  { href: '/admin/clients', label: t.nav.clients, icon: Users, exact: false },
  { href: '/admin/tasks', label: t.nav.tasks, icon: StickyNote, exact: false },
  { href: '/admin/services', label: t.nav.services, icon: Activity, exact: false },
  { href: '/admin/settings', label: t.nav.settings, icon: Settings, exact: false },
]

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
}

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* ── Sidebar (desktop only) ─────────────────────────────────────── */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]">
        {/* Brand */}
        <div className="flex items-center h-14 px-5 border-b border-[var(--color-border)] shrink-0">
          <span className="font-semibold text-[15px] text-[var(--color-fg)]">KoreLab</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-3 min-h-[44px] rounded-[var(--radius-sm)] text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-fg)]',
                ].join(' ')}
              >
                <Icon
                  className="size-5 shrink-0"
                  strokeWidth={isActive ? 2 : 1.75}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
          <p className="text-xs text-[var(--color-fg-faint)] truncate">{userEmail}</p>
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 md:ml-60">
        <Topbar userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* ── Bottom nav (mobile only) ───────────────────────────────────── */}
      <BottomNav />
    </div>
  )
}
