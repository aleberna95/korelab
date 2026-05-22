'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type LinkItem = { id: string; name: string }

type Props = {
  initialClientIds: string[]
  initialServiceIds: string[]
  availableClients: LinkItem[]
  availableServices: LinkItem[]
  onSubmit: (clientIds: string[], serviceIds: string[]) => void
  onClose: () => void
}

export function TaskLinkSheet({
  initialClientIds,
  initialServiceIds,
  availableClients,
  availableServices,
  onSubmit,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'clienti' | 'servizi'>('clienti')
  const [search, setSearch] = useState('')
  const [clientIds, setClientIds] = useState<string[]>(initialClientIds)
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds)
  const searchRef = useRef<HTMLInputElement>(null)

  // Auto-focus search only when list is long
  useEffect(() => {
    const list = tab === 'clienti' ? availableClients : availableServices
    if (list.length > 8) searchRef.current?.focus()
  }, [tab, availableClients, availableServices])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filteredClients = availableClients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredServices = availableServices.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  )

  function toggleClient(id: string) {
    setClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const totalSelected = clientIds.length + serviceIds.length

  const sheet = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] rounded-t-[var(--radius-lg)] bg-[var(--color-surface)] [box-shadow:0_-4px_32px_oklch(0_0_0/0.12)] flex flex-col max-h-[80svh]"
        role="dialog"
        aria-modal
        aria-label="Collega nota"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <span className="font-semibold text-[var(--color-fg)] text-[15px]">Collega nota</span>
          <button
            className="text-[var(--color-fg-muted)] text-xl leading-none p-1 -mr-1"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-4 shrink-0">
          {(['clienti', 'servizi'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch('') }}
              className={`py-2 px-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === t
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-[var(--color-fg-muted)]'
              }`}
            >
              {t === 'clienti' ? `👤 Clienti (${clientIds.length})` : `🧩 Servizi (${serviceIds.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'clienti' ? 'Cerca cliente…' : 'Cerca servizio…'}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-[14px] outline-none focus:border-[var(--color-accent)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-2">
          {tab === 'clienti' ? (
            filteredClients.length === 0 ? (
              <p className="text-[13px] text-[var(--color-fg-faint)] py-4 text-center">Nessun cliente trovato</p>
            ) : (
              filteredClients.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 py-3 cursor-pointer border-b border-[var(--color-border)] last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={clientIds.includes(c.id)}
                    onChange={() => toggleClient(c.id)}
                    className="w-5 h-5 rounded accent-[var(--color-accent)] shrink-0"
                  />
                  <span className="text-[15px] text-[var(--color-fg)]">{c.name}</span>
                </label>
              ))
            )
          ) : (
            filteredServices.length === 0 ? (
              <p className="text-[13px] text-[var(--color-fg-faint)] py-4 text-center">Nessun servizio trovato</p>
            ) : (
              filteredServices.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 py-3 cursor-pointer border-b border-[var(--color-border)] last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="w-5 h-5 rounded accent-[var(--color-accent)] shrink-0"
                  />
                  <span className="text-[15px] text-[var(--color-fg)]">{s.name}</span>
                </label>
              ))
            )
          )}
        </div>

        {/* Confirm */}
        <div
          className="px-4 pt-4 shrink-0 border-t border-[var(--color-border)]"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <button
            onClick={() => { onSubmit(clientIds, serviceIds); onClose() }}
            className="w-full py-3 rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-semibold text-[15px] active:opacity-80 transition-opacity"
          >
            {totalSelected === 0
              ? 'Fatto (nessun collegamento)'
              : `✓ Salva ${totalSelected} collegament${totalSelected === 1 ? 'o' : 'i'}`}
          </button>
        </div>
      </div>
    </>
  )

  if (typeof document === 'undefined') return null
  return createPortal(sheet, document.body)
}
