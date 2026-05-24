'use client'

import { useState, useMemo } from 'react'
import { PaymentCard } from './PaymentCard'
import type { Payment } from '@/lib/domain/payments'

type Filter = 'tutti' | 'aperti' | 'completati'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'aperti', label: 'Aperti' },
  { key: 'completati', label: 'Completati' },
  { key: 'tutti', label: 'Tutti' },
]

interface Props {
  initialPayments: Payment[]
}

export function PaymentsList({ initialPayments }: Props) {
  const [filter, setFilter] = useState<Filter>('aperti')

  const filtered = useMemo(() => {
    if (filter === 'tutti') return initialPayments
    if (filter === 'aperti') return initialPayments.filter((p) => p.status === 'open')
    return initialPayments.filter((p) => p.status === 'completed')
  }, [initialPayments, filter])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">
          Pagamenti
          <span className="ml-2 text-sm font-normal text-[var(--color-fg-muted)]">
            {initialPayments.length}
          </span>
        </h1>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => {
          const count =
            key === 'tutti'
              ? initialPayments.length
              : key === 'aperti'
              ? initialPayments.filter((p) => p.status === 'open').length
              : initialPayments.filter((p) => p.status === 'completed').length

          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 opacity-70">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--color-fg-faint)]">
          {filter === 'aperti'
            ? 'Nessun pagamento aperto.'
            : filter === 'completati'
            ? 'Nessun pagamento completato.'
            : 'Nessun pagamento trovato.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PaymentCard key={p.id} payment={p} />
          ))}
        </div>
      )}
    </div>
  )
}
