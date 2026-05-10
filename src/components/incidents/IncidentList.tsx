'use client'

import type { IncidentState, IncidentSeverity } from '@/lib/domain/types'
import Link from 'next/link'

const STATE_COLORS: Record<string, string> = {
  investigating: 'bg-red-100 text-red-800',
  identified: 'bg-orange-100 text-orange-800',
  monitoring: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  'false-positive': 'bg-gray-100 text-gray-600',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-600 font-bold',
  major: 'text-orange-600 font-semibold',
  minor: 'text-yellow-600',
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
    return <p className="text-sm text-gray-500 py-6 text-center">{emptyMessage}</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {incidents.map((inc) => (
        <Link
          key={inc.id}
          href={`/admin/incidents/${inc.id}`}
          className="flex items-center gap-4 py-3 px-1 hover:bg-gray-50 transition-colors group"
        >
          {/* State badge */}
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATE_COLORS[inc.state] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {inc.state}
          </span>

          {/* Title + service */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
              {inc.title}
            </p>
            <p className="text-xs text-gray-500 truncate">Servizio: {inc.serviceId}</p>
          </div>

          {/* Severity */}
          <span className={`shrink-0 text-xs capitalize ${SEVERITY_COLORS[inc.severity] ?? ''}`}>
            {inc.severity}
          </span>

          {/* Time */}
          <span className="shrink-0 text-xs text-gray-400">
            {formatTime(inc.startedAt)}
          </span>
        </Link>
      ))}
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
