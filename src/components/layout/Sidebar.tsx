'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: '⬛' },
  { href: '/admin/onboarding', label: 'Onboard', icon: '➕' },
  { href: '/admin/clients', label: 'Clients', icon: '👥' },
  { href: '/admin/services', label: 'Services', icon: '🔧' },
  { href: '/admin/incidents', label: 'Incidents', icon: '🚨' },
  { href: '/admin/monitors', label: 'Monitors', icon: '📡' },
  { href: '/admin/reports', label: 'Reports', icon: '📊' },
  { href: '/admin/tokens', label: 'Tokens', icon: '🔑' },
  { href: '/admin/runbooks', label: 'Runbooks', icon: '📖' },
  { href: '/admin/tasks', label: 'Tasks', icon: '✅' },
  { href: '/admin/audit', label: 'Audit Log', icon: '🔍' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export function Sidebar() {
  // Note: usePathname is a Client Component hook — this component is 'use client'
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo / brand */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Command Center
        </p>
        <p className="text-sm font-bold text-white mt-0.5">Alessio Bernardini</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              ].join(' ')}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">v0.1.0 — Phase 1</p>
      </div>
    </aside>
  )
}
