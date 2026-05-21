'use client'

import type { IncidentState, IncidentSeverity } from '@/lib/domain/types'
import Link from 'next/link'

const STATE_COLOR: Record<string, string> = {
  investigating: 'var(--color-danger)',
  identified:    'var(--color-warning)',
  monitoring:    'var(--color-warning)',
  resolved:      'var(--color-success)',
  'false-positive': 'var(--color-fg-faint)',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-danger)',
  major:    'var(--color-warning)',
  minor:    'var(--color-fg-muted)',
}

const SEVERITY_WEIGHT: Record<string, string> = {
  critical: 'font-bold',
  major:    'font-semibold',
  minor:    '',
}

export type IncidentListItem = {
  id: string
  state: IncidentState
  severity: IncidentSeverity
  title: string
  serviceId: string
  startedAt: string // ISO string
}

type Props = {
  incidents: IncidentListItem[]
  emptyMessage?: string
}

export function IncidentList({ incidents, emptyMessage = 'Nessun incidente trovato.' }: Props) {
  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <span className="text-4xl select-none">✅</span>
        <p className="text-sm text-[var(--color-fg-faint)] text-center">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {incidents.map((inc) => {
        const stateColor = STATE_COLOR[inc.state] ?? 'var(--color-fg-faint)'
        const severityColor = SEVERITY_COLOR[inc.severity] ?? 'var(--color-fg-muted)'
        return (
          <Link
            key={inc.id}
            href={`/admin/incidents/${inc.id}`}
            className="flex items-center gap-4 py-3 px-1 hover:bg-[var(--color-accent-soft)] transition-colors group rounded-sm"
          >
            {/* State badge */}
            <span
              className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize"
              style={{
                background: `color-mix(in oklch, ${stateColor} 18%, transparent)`,
                color: stateColor,
              }}
            >
              {inc.state}
            </span>

            {/* Title + service */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-fg)] truncate group-hover:text-[var(--color-accent)]">
                {inc.title}
              </p>
              <p className="text-xs text-[var(--color-fg-faint)] truncate">Servizio: {inc.serviceId}</p>
            </div>

            {/* Severity */}
            <span
              className={`shrink-0 text-xs capitalize ${SEVERITY_WEIGHT[inc.severity] ?? ''}`}
              style={{ color: severityColor }}
            >
              {inc.severity}
            </span>

            {/* Time */}
            <span className="shrink-0 text-xs text-[var(--color-fg-faint)]">
              {formatTime(inc.startedAt)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function formatTime(isoString: string): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}
