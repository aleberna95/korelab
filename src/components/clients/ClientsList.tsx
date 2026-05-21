'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Client } from '@/lib/domain/types'

function normalize(s: string) {
  return s.toLowerCase().trim()
}

function matchesQuery(client: Client, q: string): boolean {
  if (!q) return true
  const n = normalize(q)
  return (
    normalize(client.name).includes(n) ||
    (client.email ? normalize(client.email).includes(n) : false) ||
    client.tags.some((t) => normalize(t).includes(n))
  )
}

export function ClientsList({ initialClients }: { initialClients: Client[] }) {
  const [query, setQuery] = useState('')
  const filtered = initialClients.filter((c) => matchesQuery(c, query))

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h1 className="text-display font-bold text-[var(--color-fg)]">Clienti</h1>
          <span className="text-sm text-[var(--color-fg-faint)]">
            {initialClients.length} totali
          </span>
        </div>
        {/* Desktop: primary button in header */}
        <Link
          href="/admin/clients/new"
          className="hidden md:inline-flex btn-primary text-sm px-4 py-2"
        >
          + Aggiungi cliente
        </Link>
      </div>

      {/* Search — sticky under topbar */}
      <div className="sticky top-14 z-10 pb-3 bg-[var(--color-bg)]">
        <input
          type="search"
          placeholder="Cerca per nome, email, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base h-11"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-5xl select-none">🌱</span>
          <p className="text-[var(--color-fg-muted)] text-sm text-center">
            {query ? 'Nessun risultato per quella ricerca.' : 'Nessun cliente ancora.'}
          </p>
          {!query && (
            <Link href="/admin/clients/new" className="btn-primary text-sm px-4 py-2 mt-1">
              Aggiungi il primo cliente
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((client, i) => (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              className="group block bg-[var(--color-surface)] rounded-[var(--radius)] p-4 border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors card-lift"
              style={{
                boxShadow: 'var(--shadow-card)',
                animation: 'fadeSlideIn var(--dur-slow) var(--ease-out) both',
                animationDelay: `${Math.min(i * 20, 200)}ms`,
              }}
            >
              <p className="font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] truncate">
                {client.name}
              </p>
              {client.email && (
                <p className="text-sm text-[var(--color-fg-muted)] mt-0.5 truncate">
                  {client.email}
                </p>
              )}
              {!client.email && client.phone && (
                <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">{client.phone}</p>
              )}
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {client.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* FAB — mobile only */}
      <Link
        href="/admin/clients/new"
        aria-label="Aggiungi cliente"
        className="md:hidden fixed bottom-20 right-4 z-20 flex items-center justify-center size-14 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-2xl font-light leading-none hover:scale-105 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 20px oklch(0.62 0.19 258 / 0.40)' }}
      >
        +
      </Link>
    </div>
  )
}
