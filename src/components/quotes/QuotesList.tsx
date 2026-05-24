'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuoteListItem } from './QuoteListItem'
import { createQuoteDraft } from '@/lib/actions/quotes'
import type { Quote } from '@/lib/domain/quotes'
import type { Client } from '@/lib/domain/types'

// ─── Filter chips ─────────────────────────────────────────────────────────────

type Filter = 'tutti' | 'bozza' | 'in-approvazione' | 'approvato' | 'archivio'

const FILTER_LABELS: Record<Filter, string> = {
  tutti: 'Tutti',
  bozza: 'Bozza',
  'in-approvazione': 'In approvazione',
  approvato: 'Approvato',
  archivio: 'Archivio',
}
const FILTERS: Filter[] = ['tutti', 'bozza', 'in-approvazione', 'approvato', 'archivio']

function normalize(s: string) {
  return s.toLowerCase().trim()
}

function matchesQuery(quote: Quote, q: string): boolean {
  if (!q) return true
  const n = normalize(q)
  return (
    normalize(quote.number).includes(n) ||
    normalize(quote.clientSnapshot.name).includes(n)
  )
}

// ─── New Quote Dialog ─────────────────────────────────────────────────────────

function NewQuoteDialog({
  open,
  onOpenChange,
  clients,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clients: Pick<Client, 'id' | 'name'>[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')

  function handleCreate() {
    if (!clientId) return
    startTransition(async () => {
      try {
        const { id } = await createQuoteDraft(clientId)
        onOpenChange(false)
        router.push(`/admin/quotes/${id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Non sono riuscito a creare il preventivo.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuovo preventivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-sm text-[var(--color-fg-muted)] mb-1">
              Cliente <span className="text-[var(--color-danger)]">*</span>
            </label>
            {clients.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">
                Nessun cliente disponibile. Aggiungi prima un cliente.
              </p>
            ) : (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 px-4 rounded-[var(--radius)] border border-[var(--color-border)] text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !clientId}
              className="h-11 px-5 rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {isPending ? 'Creazione…' : 'Crea preventivo'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function QuotesList({
  initialQuotes,
  clients,
}: {
  initialQuotes: Quote[]
  clients: Pick<Client, 'id' | 'name'>[]
}) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<Filter>('tutti')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = initialQuotes.filter((q) => {
    const statusMatch =
      activeFilter === 'archivio'
        ? q.status === 'rifiutato'
        : activeFilter === 'tutti'
          ? q.status !== 'rifiutato'
          : q.status === activeFilter
    return statusMatch && matchesQuery(q, query)
  })

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h1 className="text-display font-bold text-[var(--color-fg)]">Preventivi</h1>
          <span className="text-sm text-[var(--color-fg-faint)]">
            {initialQuotes.length} totali
          </span>
        </div>
        {/* Desktop CTA */}
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="hidden md:inline-flex items-center gap-1.5 h-11 px-4 rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-sm font-medium transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          Aggiungi preventivo
        </button>
      </div>

      {/* Search + filters — sticky */}
      <div className="sticky top-14 z-10 pb-3 bg-[var(--color-bg)] space-y-2">
        <input
          type="search"
          placeholder="Cerca per numero o cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base h-11"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === f
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-5xl select-none">📄</span>
          <p className="text-[var(--color-fg-muted)] text-sm text-center">
            {query || activeFilter !== 'tutti'
              ? 'Nessun preventivo corrisponde ai filtri.'
              : 'Nessun preventivo ancora.'}
          </p>
          {!query && activeFilter === 'tutti' && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="btn-primary text-sm px-4 py-2 mt-1"
            >
              Crea il primo preventivo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((quote, i) => (
            <div
              key={quote.id}
              style={{
                animation: 'fadeSlideIn var(--dur-slow) var(--ease-out) both',
                animationDelay: `${Math.min(i * 20, 200)}ms`,
              }}
            >
              <QuoteListItem quote={quote} />
            </div>
          ))}
        </div>
      )}

      {/* FAB — mobile only */}
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        aria-label="Aggiungi preventivo"
        className="md:hidden fixed bottom-20 right-4 z-20 flex items-center justify-center size-14 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:scale-105 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 20px oklch(0.62 0.19 258 / 0.40)' }}
      >
        <Plus size={22} />
      </button>

      <NewQuoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clients={clients}
      />
    </div>
  )
}
