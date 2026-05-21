'use client'

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'korelab:pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed permanently
    if (localStorage.getItem(DISMISSED_KEY)) return

    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !deferredPrompt) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, '1')
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
    setDeferredPrompt(null)
  }

  return (
    <div
      role="banner"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] [box-shadow:var(--shadow-pop)]"
      style={{ animation: 'fadeSlideIn 260ms var(--ease-out) both' }}
    >
      <span className="text-2xl shrink-0 select-none" aria-hidden>
        📲
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-fg)] leading-tight">
          Installa KoreLab
        </p>
        <p className="text-xs text-[var(--color-fg-muted)]">Accesso rapido dalla home</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="btn-primary text-xs px-3 py-1.5"
          aria-label="Installa app"
        >
          Installa
        </button>
        <button
          onClick={handleDismiss}
          className="text-[var(--color-fg-faint)] hover:text-[var(--color-fg)] text-lg leading-none"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
    </div>
  )
}
