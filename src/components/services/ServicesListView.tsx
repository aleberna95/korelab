'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ServiceStatusState } from '@/lib/domain/types'
import type { UptimeResult } from '@/lib/services/uptime'
import { ServiceCard } from './ServiceCard'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceRow = {
  id: string
  name: string
  clientId: string
  checkUrl?: string
  initialState: ServiceStatusState
  uptime: UptimeResult
}

export type ClientOption = {
  id: string
  name: string
}

type Props = {
  rows: ServiceRow[]
  clients: ClientOption[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDown(state: ServiceStatusState) {
  return state === 'major-outage' || state === 'partial-outage'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServicesListView({ rows, clients }: Props) {
  const [filter, setFilter] = useState<'all' | 'down' | string>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const downCount = rows.filter((r) => isDown(r.initialState)).length

  // Filtered rows
  const visibleRows =
    filter === 'down'
      ? rows.filter((r) => isDown(r.initialState))
      : filter === 'all'
        ? rows
        : rows.filter((r) => r.clientId === filter)

  // Client name map
  const clientNames = new Map(clients.map((c) => [c.id, c.name]))

  // Group by clientId (preserving insertion order)
  const grouped = new Map<string, ServiceRow[]>()
  for (const row of visibleRows) {
    const existing = grouped.get(row.clientId)
    if (existing) {
      existing.push(row)
    } else {
      grouped.set(row.clientId, [row])
    }
  }

  function toggleCollapse(clientId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const chipCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--color-accent)] text-white'
        : 'bg-[var(--color-surface-raised)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
    }`

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chipCls(filter === 'all')}
          onClick={() => setFilter('all')}
        >
          Tutti
          <span className="ml-1.5 opacity-70">{rows.length}</span>
        </button>
        <button
          type="button"
          className={chipCls(filter === 'down')}
          onClick={() => setFilter('down')}
        >
          Solo down
          {downCount > 0 && (
            <span
              className="ml-1.5 font-bold"
              style={{ color: filter === 'down' ? 'white' : 'var(--color-danger)' }}
            >
              {downCount}
            </span>
          )}
        </button>
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            className={chipCls(filter === c.id)}
            onClick={() => setFilter(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {visibleRows.length === 0 && (
        <p className="py-12 text-center text-[var(--color-fg-faint)]">
          {filter === 'down' ? 'Tutti i servizi sono operativi 🟢' : 'Nessun servizio.'}
        </p>
      )}

      {/* Grouped accordion */}
      {filter !== 'down' ? (
        <div className="space-y-4">
          {[...grouped.entries()].map(([clientId, services]) => {
            const hasDown = services.some((s) => isDown(s.initialState))
            const isCollapsed = collapsed.has(clientId)

            return (
              <section key={clientId}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(clientId)}
                  className="w-full flex items-center gap-2 px-1 py-2 text-left group"
                  aria-expanded={!isCollapsed}
                >
                  {/* Summary dot */}
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: hasDown
                        ? 'var(--color-danger)'
                        : 'var(--color-success)',
                    }}
                  />
                  <span className="font-semibold text-[var(--color-fg)] flex-1 text-[15px]">
                    {clientNames.get(clientId) ?? 'Cliente sconosciuto'}
                  </span>
                  <span className="text-[13px] text-[var(--color-fg-faint)]">
                    {services.length}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-[var(--color-fg-faint)] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Cards */}
                {!isCollapsed && (
                  <div className="grid gap-3 sm:grid-cols-2 mt-1">
                    {services.map((svc) => (
                      <ServiceCard
                        key={svc.id}
                        id={svc.id}
                        name={svc.name}
                        checkUrl={svc.checkUrl}
                        initialState={svc.initialState}
                        uptime={svc.uptime}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        // Flat list for "Solo down"
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleRows.map((svc) => (
            <ServiceCard
              key={svc.id}
              id={svc.id}
              name={svc.name}
              checkUrl={svc.checkUrl}
              initialState={svc.initialState}
              uptime={svc.uptime}
            />
          ))}
        </div>
      )}

      {/* Add service CTA */}
      <div className="pt-2 flex justify-end">
        <Link href="/admin/services/new" className="btn-primary text-sm">
          + Aggiungi servizio
        </Link>
      </div>
    </div>
  )
}
