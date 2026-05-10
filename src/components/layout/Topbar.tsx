'use client'

import { useRouter } from 'next/navigation'

interface TopbarProps {
  userEmail: string
}

export function Topbar({ userEmail }: TopbarProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      {/* Left — breadcrumb placeholder */}
      <div />

      {/* Right — user info + logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">{userEmail}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800"
        >
          Log out
        </button>
      </div>
    </header>
  )
}
