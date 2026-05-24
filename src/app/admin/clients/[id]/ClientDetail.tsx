'use client'

import Link from 'next/link'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ServiceStatusState, IncidentState } from '@/lib/domain/types'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import type { LinkItem } from '@/components/tasks/TaskLinkSheet'
import { TaskInlineSection } from '@/components/tasks/TaskInlineSection'
import { createQuoteDraft } from '@/lib/actions/quotes'
import { formatEUR } from '@/lib/money'

// ─── Serializable prop types (Timestamps converted to ms on server) ─────────

export type ClientData = {
  id: string
  name: string
  email?: string
  phone?: string
  vatNumber?: string
  taxCode?: string
  address?: string
  pec?: string
  sdi?: string
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

export type QuoteRow = {
  id: string
  number: string
  status: 'bozza' | 'in-approvazione' | 'approvato' | 'rifiutato'
  totalCents: number
  createdAtMs: number
}

export type PaymentRow = {
  id: string
  number: string
  quoteNumber: string
  totalCents: number
  status: 'open' | 'completed' | 'cancelled'
  paidCount: number
  totalCount: number
}

// ─── Badge maps ─────────────────────────────────────────────────────────────

const QUOTE_STATUS_BADGE: Record<QuoteRow['status'], { label: string; className: string }> = {
  bozza: {
    label: 'Bozza',
    className: 'bg-[var(--color-bg)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
  },
  'in-approvazione': {
    label: 'In approvazione',
    className: 'bg-[oklch(0.96_0.06_85)] text-[oklch(0.45_0.15_85)] border border-[oklch(0.88_0.10_85)]',
  },
  approvato: {
    label: 'Approvato',
    className: 'bg-[oklch(0.95_0.06_150)] text-[oklch(0.40_0.14_150)] border border-[oklch(0.86_0.10_150)]',
  },
  rifiutato: {
    label: 'Rifiutato',
    className: 'bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)] border border-[oklch(0.88_0.10_25)]',
  },
}

const PAYMENT_STATUS_BADGE: Record<PaymentRow['status'], { label: string; className: string }> = {
  open: {
    label: 'Aperto',
    className: 'bg-[var(--color-bg)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
  },
  completed: {
    label: 'Completato',
    className: 'bg-[oklch(0.95_0.06_150)] text-[oklch(0.40_0.14_150)] border border-[oklch(0.86_0.10_150)]',
  },
  cancelled: {
    label: 'Annullato',
    className: 'bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)] border border-[oklch(0.88_0.10_25)]',
  },
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
  initialTasks: SerializedTask[]
  availableClients: LinkItem[]
  availableServices: LinkItem[]
  quotes?: QuoteRow[]
  payments?: PaymentRow[]
}

export function ClientDetail({ client, initialServices, recentIncidents, serviceNameMap, initialTasks, availableClients, availableServices, quotes = [], payments = [] }: Props) {
  const router = useRouter()
  const [services, setServices] = useState<ServiceRow[]>(initialServices)
  const [isCreatingQuote, startQuoteTransition] = useTransition()

  function handleNewQuote() {
    startQuoteTransition(async () => {
      try {
        const { id } = await createQuoteDraft(client.id)
        router.push(`/admin/quotes/${id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore durante la creazione del preventivo.')
      }
    })
  }

  // Realtime services subscription
  useEffect(() => {
    let active = true
    let unsub: (() => void) | undefined

    Promise.all([
      import('@/lib/firebase/client'),
      import('firebase/firestore'),
    ]).then(async ([{ clientApp, waitForAuth }, firestore]) => {
      await waitForAuth()
      if (!active) return
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
      active = false
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
        {client.address && (
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">{client.address}</p>
        )}
        {(client.vatNumber || client.taxCode || client.pec || client.sdi) && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {client.vatNumber && (
              <div className="text-xs text-[var(--color-fg-faint)]">
                P.IVA <span className="text-[var(--color-fg-muted)] font-medium">{client.vatNumber}</span>
              </div>
            )}
            {client.taxCode && (
              <div className="text-xs text-[var(--color-fg-faint)]">
                CF <span className="text-[var(--color-fg-muted)] font-medium">{client.taxCode}</span>
              </div>
            )}
            {client.pec && (
              <div className="text-xs text-[var(--color-fg-faint)]">
                PEC <span className="text-[var(--color-fg-muted)] font-medium">{client.pec}</span>
              </div>
            )}
            {client.sdi && (
              <div className="text-xs text-[var(--color-fg-faint)]">
                SDI <span className="text-[var(--color-fg-muted)] font-medium">{client.sdi}</span>
              </div>
            )}
          </dl>
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

      {/* Static notes field */}
      {client.notes && (
        <section>
          <h2 className="text-h2 text-[var(--color-fg)] mb-2">Note</h2>
          <p className="text-sm text-[var(--color-fg-muted)] whitespace-pre-wrap">{client.notes}</p>
        </section>
      )}

      {/* Preventivi */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h2 text-[var(--color-fg)]">
            Preventivi{quotes.length > 0 ? ` (${quotes.length})` : ''}
          </h2>
          <button
            type="button"
            onClick={handleNewQuote}
            disabled={isCreatingQuote}
            className="text-sm text-[var(--color-accent)] hover:underline disabled:opacity-50"
          >
            {isCreatingQuote ? 'Creazione…' : '+ Nuovo preventivo'}
          </button>
        </div>
        <div
          className="bg-[var(--color-surface)] rounded-[var(--radius)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {quotes.map((q) => {
            const badge = QUOTE_STATUS_BADGE[q.status]
            return (
              <Link
                key={q.id}
                href={`/admin/quotes/${q.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-accent-soft)] transition-colors group"
              >
                <span className="font-mono text-sm text-[var(--color-fg)] group-hover:text-[var(--color-accent)] shrink-0">
                  {q.number}
                </span>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="flex-1" />
                <span className="text-sm text-[var(--color-fg-muted)] shrink-0">
                  {formatEUR(q.totalCents)}
                </span>
                <span suppressHydrationWarning className="text-xs text-[var(--color-fg-faint)] shrink-0 w-20 text-right">
                  {new Date(q.createdAtMs).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </Link>
            )
          })}
          {quotes.length === 0 && (
            <p className="px-4 py-6 text-sm text-center text-[var(--color-fg-faint)]">
              Nessun preventivo.
            </p>
          )}
        </div>
      </section>

      {/* Pagamenti */}
      {payments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[var(--color-fg)]">Pagamenti ({payments.length})</h2>
          </div>
          <div
            className="bg-[var(--color-surface)] rounded-[var(--radius)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            {payments.map((p) => {
              const badge = PAYMENT_STATUS_BADGE[p.status]
              return (
                <Link
                  key={p.id}
                  href={`/admin/payments/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-accent-soft)] transition-colors group"
                >
                  <span className="font-mono text-sm text-[var(--color-fg)] group-hover:text-[var(--color-accent)] shrink-0">
                    {p.number}
                  </span>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs text-[var(--color-fg-faint)] shrink-0">
                    {p.quoteNumber}
                  </span>
                  <span className="flex-1" />
                  <span className="text-sm text-[var(--color-fg-muted)] shrink-0">
                    {formatEUR(p.totalCents)}
                  </span>
                  {p.totalCount > 0 && (
                    <span className="text-xs text-[var(--color-fg-faint)] shrink-0">
                      {p.paidCount}/{p.totalCount} rate
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Task inline section */}
      <TaskInlineSection
        entityId={client.id}
        entityType="client"
        entityName={client.name}
        initialTasks={initialTasks}
        availableClients={availableClients}
        availableServices={availableServices}
      />

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
                <span suppressHydrationWarning className="text-xs text-[var(--color-fg-faint)] shrink-0">
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
