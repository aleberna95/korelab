'use client'

import { useRouter } from 'next/navigation'

interface TopbarProps {
  userEmail: string
  onToggleSidebar: () => void
}

export function Topbar({ userEmail, onToggleSidebar }: TopbarProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
      {/* Left — hamburger on mobile */}
      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Apri menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Desktop left spacer */}
      <div className="hidden md:block" />

      {/* Right — user info + logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 hidden sm:inline">{userEmail}</span>
        <button
          onClick={handleLogout}
          className="btn-secondary text-sm px-3 py-1.5 min-h-[44px]"
        >
          Disconnetti
        </button>
      </div>
    </header>
  )
}
