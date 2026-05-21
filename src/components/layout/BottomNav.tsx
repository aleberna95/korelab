'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, StickyNote, Activity } from 'lucide-react'
import { t } from '@/lib/i18n/it'

const NAV_ITEMS = [
  { href: '/admin', label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
  { href: '/admin/clients', label: t.nav.clients, icon: Users, exact: false },
  { href: '/admin/tasks', label: t.nav.tasks, icon: StickyNote, exact: false },
  { href: '/admin/services', label: t.nav.services, icon: Activity, exact: false },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-end bg-[var(--color-surface)] border-t border-[var(--color-border)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex w-full h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-1 transition-colors active:scale-95',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-fg-faint)] hover:text-[var(--color-fg-muted)]',
              ].join(' ')}
            >
              <Icon className="size-6" strokeWidth={isActive ? 2 : 1.75} />
              <span className="text-[11px] leading-none font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
