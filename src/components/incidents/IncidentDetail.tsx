'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Incident, IncidentTimelineEvent } from '@/lib/domain/types'
import { IncidentTimeline } from './IncidentTimeline'
import { IncidentEditor } from './IncidentEditor'

const STATE_COLORS: Record<string, string> = {
  investigating: 'bg-red-100 text-red-800',
  identified: 'bg-orange-100 text-orange-800',
  monitoring: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  'false-positive': 'bg-gray-100 text-gray-600',
}

type Props = {
  incident: Incident
  initialTimeline: IncidentTimelineEvent[]
}

export function IncidentDetail({ incident, initialTimeline }: Props) {
  const router = useRouter()
  const [timeline, setTimeline] = useState(initialTimeline)

  async function refreshTimeline() {
    try {
      const res = await fetch(`/api/incidents/${incident.id}`)
      const data = await res.json()
      setTimeline(data.timeline ?? [])
      router.refresh()
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: meta + editor ─────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATE_COLORS[incident.state] ?? 'bg-gray-100'}`}
          >
            {incident.state}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{incident.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Service: {incident.serviceId} · Severity:{' '}
              <span className="capitalize font-medium">{incident.severity}</span>
            </p>
          </div>
        </div>

        {/* Meta grid */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <MetaItem label="Source" value={incident.source} />
          <MetaItem label="Visibility" value={incident.visibility} />
          <MetaItem label="Notified client" value={incident.notifiedClient ? 'Yes' : 'No'} />
          <MetaItem label="Started" value={formatTime(incident.startedAt as unknown as { toDate(): Date })} />
          {incident.resolvedAt && (
            <MetaItem
              label="Resolved"
              value={formatTime(incident.resolvedAt as unknown as { toDate(): Date })}
            />
          )}
          {incident.metrics.downtimeSec != null && (
            <MetaItem label="Downtime" value={formatDuration(incident.metrics.downtimeSec)} />
          )}
        </dl>

        {/* Editor */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Edit
          </h3>
          <IncidentEditor incident={incident} onSaved={refreshTimeline} />
        </section>
      </div>

      {/* ── Right: timeline ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Timeline
        </h3>
        <IncidentTimeline timeline={timeline} />
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium capitalize">{value}</dd>
    </div>
  )
}

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ts.toDate())
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${(sec / 3600).toFixed(1)}h`
}
