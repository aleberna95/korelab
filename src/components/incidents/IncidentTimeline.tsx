'use client'

import type { IncidentTimelineEvent } from '@/lib/domain/types'

const KIND_ICONS: Record<string, string> = {
  detected: '🔴',
  updated: '🔶',
  comment: '💬',
  resolved: '✅',
  reopened: '🔁',
}

type Props = {
  timeline: IncidentTimelineEvent[]
}

export function IncidentTimeline({ timeline }: Props) {
  if (timeline.length === 0) {
    return <p className="text-sm text-gray-400">No timeline events.</p>
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {timeline.map((ev) => (
        <li key={ev.id} className="ml-4">
          {/* Dot */}
          <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-white border-2 border-gray-300" />

          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">
              {KIND_ICONS[ev.kind] ?? '•'}
            </span>
            <div>
              <p className="text-sm text-gray-800">{ev.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatTime(ev.at as unknown as { toDate(): Date })}
                {ev.byUid ? ` · ${ev.byUid}` : ''}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ts.toDate())
}
