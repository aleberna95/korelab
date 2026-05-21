'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { ServiceStatusState, IncidentState } from '@/lib/domain/types'

// ─── Serializable prop types (Timestamps converted to ms on server) ─────────

export type ClientData = {
  id: string
  name: string
  email?: string
  phone?: string
  notes?: string
  tags: string[]
  status: 'active' | 'archived'
}

export type ServiceRow = {
  id: string
  name: string
  state: ServiceStatusState
  sinceMs: number
  checkUrl?: string
}

export type IncidentRow = {
  id: string
  serviceId: string
  state: IncidentState
  title: string
  startedAtMs: number
  resolvedAtMs?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ state }: { state: ServiceStatusState }) {
  const color =
    state === 'major-outage' || state === 'partial-outage'
      ? 'var(--color-danger)'
      : state === 'degraded'
        ? 'var(--color-warning)'
        : state === 'unknown'
          ? 'var(--color-fg-faint)'
          : 'var(--color-success)'
  return (
    <span
      className="inline-block size-2.5 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

function formatRelativeMs(ms: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins}m fa`
  const hrs = Math.round(diff / 3600000)
  if (hrs < 24) return `${hrs}h fa`
  const days = Math.round(diff / 86400000)
  return `${days}g fa`
}

function incidentStateLabel(state: IncidentState): string {
  switch (state) {
    case 'investigating': return 'in corso'
    case 'identified': return 'identificato'
    case 'monitoring': return 'monitoraggio'
    case 'resolved': return 'risolto'
    case 'false-positive': return 'falso positivo'
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  client: ClientData
  initialServices: ServiceRow[]
  recentIncidents: IncidentRow[]
  serviceNameMap: Record<string, string>
}

export function ClientDetail({ client, initialServices, recentIncidents, serviceNameMap }: Props) {
  const [services, setServices] = useState<ServiceRow[]>(initialServices)

  // Realtime services subscription
  useEffect(() => {
    let unsub: (() => void) | undefined

    Promise.all([
      import('@/lib/firebase/client'),
      import('firebase/firestore'),
    ]).then(([{ clientApp }, firestore]) => {
      const { getFirestore, collection, query, where, onSnapshot } = firestore
      const db = getFirestore(clientApp)
      const q = query(collection(db, 'services'), where('clientId', '==', client.id))

      unsub = onSnapshot(q, (snap) => {
        const rows: ServiceRow[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name as string,
            state: (data.currentStatus?.state ?? 'unknown') as ServiceStatusState,
            sinceMs: ((data.currentStatus?.since?.seconds ?? 0) as number) * 1000,
            checkUrl: data.check?.url as string | undefined,
          }
        })
        rows.sort((a, b) => a.name.localeCompare(b.name))
        setServices(rows)
      })
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') unsub?.()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      unsub?.()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [client.id])

  const isActive = (state: IncidentState) =>
    state !== 'resolved' && state !== 'false-positive'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Back + edit */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/clients"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] flex items-center gap-1"
        >
          ← Clienti
        </Link>
        <Link
          href={`/admin/clients/${client.id}/edit`}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Modifica
        </Link>
      </div>

      {/* Client header */}
      <header>
        <h1 className="text-h1 font-semibold text-[var(--color-fg)]">{client.name}</h1>
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] block mt-1"
          >
            {client.email}
          </a>
        )}
        {client.phone && (
          <a href={`tel:${client.phone}`} className="text-sm text-[var(--color-fg-muted)] block">
            {client.phone}
          </a>
        )}
        {client.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {client.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Notes */}
      {client.notes && (
        <section>
          <h2 className="text-h2 text-[var(--color-fg)] mb-2">Note</h2>
          <p className="text-sm text-[var(--color-fg-muted)] whitespace-pre-wrap">{client.notes}</p>
        </section>
      )}

      {/* Services — realtime */}
      <section>
        <h2 className="text-h2 text-[var(--color-fg)] mb-3">Servizi ({services.length})</h2>
        <div
          className="bg-[var(--color-surface)] rounded-[var(--radius)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {services.map((svc) => (
            <Link
              key={svc.id}
              href={`/admin/services/${svc.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-accent-soft)] transition-colors group"
            >
              <StatusDot state={svc.state} />
              <span className="flex-1 text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] truncate">
                {svc.name}
              </span>
              {svc.sinceMs > 0 && (
                <span className="text-xs text-[var(--color-fg-faint)] shrink-0">
                  {formatRelativeMs(svc.sinceMs)}
                </span>
              )}
            </Link>
          ))}
          {services.length === 0 && (
            <p className="px-4 py-6 text-sm text-center text-[var(--color-fg-faint)]">
              Nessun servizio.
            </p>
          )}
        </div>
        <Link
          href={`/admin/services/new?clientId=${client.id}`}
          className="mt-3 flex items-center justify-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
        >
          + Aggiungi servizio
        </Link>
      </section>

      {/* Recent incidents */}
      {recentIncidents.length > 0 && (
        <section>
          <h2 className="text-h2 text-[var(--color-fg)] mb-3">Ultimi incident</h2>
          <div className="border-l-2 border-[var(--color-border)] pl-4 ml-1 space-y-4">
            {recentIncidents.map((inc) => {
              const svcName = serviceNameMap[inc.serviceId] ?? inc.serviceId
              const active = isActive(inc.state)
              return (
                <Link
                  key={inc.id}
                  href={`/admin/incidents/${inc.id}`}
                  className="block group"
                >
                  <p className="text-xs text-[var(--color-fg-faint)]">
                    {new Date(inc.startedAtMs).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                  <p className="text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
                    {svcName}
                  </p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {inc.title} ·{' '}
                    <span
                      className={
                        active
                          ? 'text-[var(--color-danger)]'
                          : 'text-[var(--color-fg-faint)]'
                      }
                    >
                      {incidentStateLabel(inc.state)}
                    </span>
                  </p>
                </Link>
              )
            })}
          </div>
          <Link
            href={`/admin/incidents?clientId=${client.id}`}
            className="mt-3 text-xs text-[var(--color-accent)] hover:underline inline-block"
          >
            Vedi tutti →
          </Link>
        </section>
      )}
    </div>
  )
}
