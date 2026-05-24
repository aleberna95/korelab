'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sun, Moon, LogOut, Settings } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n/it'

interface TopbarProps {
  userEmail: string
}

export function Topbar({ userEmail }: TopbarProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-6 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
      {/* Logo — visible on mobile only (sidebar has it on desktop) */}
      <span className="md:hidden font-semibold text-[15px] text-[var(--color-fg)]">
        KoreLab
      </span>
      <div className="hidden md:block" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <span className="hidden sm:block text-[13px] text-[var(--color-fg-muted)] mr-2">
          {userEmail}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={t.common.changeTheme}
        >
          {resolvedTheme === 'dark'
            ? <Sun className="size-5" />
            : <Moon className="size-5" />
          }
        </Button>

        <Button variant="ghost" size="icon" asChild aria-label={t.nav.settings}>
          <Link href="/admin/settings">
            <Settings className="size-5" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label={t.common.logout}
        >
          <LogOut className="size-5" />
        </Button>
      </div>
    </header>
  )
}

