'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin', label: 'Panoramica', icon: '⬛' },
  { href: '/admin/onboarding', label: 'Onboarding', icon: '➕' },
  { href: '/admin/clients', label: 'Clienti', icon: '👥' },
  { href: '/admin/services', label: 'Servizi', icon: '🔧' },
  { href: '/admin/incidents', label: 'Incidenti', icon: '🚨' },
  { href: '/admin/monitors', label: 'Monitor', icon: '📡' },
  { href: '/admin/tasks', label: 'Attività', icon: '✅' },
  { href: '/admin/audit', label: 'Log di Audit', icon: '🔍' },
  { href: '/admin/settings', label: 'Impostazioni', icon: '⚙️' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0 md:w-60 md:transition-none',
      ].join(' ')}
    >
      {/* Logo / brand + close button */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Command Center
          </p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">Alessio Bernardini</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Chiudi menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
              onClick={onClose}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">v0.1.0 — Phase 1</p>
      </div>
    </aside>
  )
}
