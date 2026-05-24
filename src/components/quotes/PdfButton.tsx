'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp } from '@/lib/firebase/client'

interface Props {
  quoteId: string
}

async function openOrShare(url: string): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    /Mobi|Android/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ title: 'Preventivo PDF', url })
      return
    } catch {
      // User cancelled or share failed — fall through to window.open
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function PdfButton({ quoteId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const fns = getFunctions(clientApp)
      const generate = httpsCallable<{ quoteId: string }, { url: string }>(
        fns,
        'generateQuotePdf',
      )
      const result = await generate({ quoteId })
      await openOrShare(result.data.url)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Errore durante la generazione del PDF.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Genera e scarica PDF"
      aria-label="Genera e scarica PDF"
      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium
        bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)]
        hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      <span className="hidden sm:inline">{loading ? 'Generazione…' : 'PDF'}</span>
    </button>
  )
}
