'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ServiceStatusState } from '@/lib/domain/types'
import type { UptimeResult } from '@/lib/services/uptime'

// ─── Status dot ────────────────────────────────────────────────────────────

function StatusDot({ state }: { state: ServiceStatusState }) {
  const color =
    state === 'major-outage' || state === 'partial-outage'
      ? 'var(--color-danger)'
      : state === 'unknown'
        ? 'var(--color-fg-faint)'
        : 'var(--color-success)'

  return (
    <span
      className="inline-block size-2.5 rounded-full shrink-0 mt-[3px]"
      style={{ backgroundColor: color }}
    />
  )
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function Sparkline({ segments }: { segments: UptimeResult['segments'] }) {
  const now = Date.now()
  const windowStart = now - 30 * DAY_MS

  const bars = Array.from({ length: 30 }, (_, i) => {
    const dayStart = windowStart + i * DAY_MS
    const dayEnd = dayStart + DAY_MS
    let downMs = 0
    for (const seg of segments) {
      const s = Math.max(seg.start, dayStart)
      const e = Math.min(seg.end, dayEnd)
      if (e > s) downMs += e - s
    }
    return Math.min(1, downMs / DAY_MS)
  })

  return (
    <svg
      width="100%"
      height="24"
      viewBox="0 0 120 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block"
    >
      {bars.map((fraction, i) => (
        <rect
          key={i}
          x={i * 4}
          y={0}
          width={3}
          height={24}
          rx={1}
          style={{
            fill: fraction > 0 ? 'var(--color-danger)' : 'var(--color-success)',
            opacity: fraction > 0 ? Math.max(0.5, fraction) : 0.7,
          }}
        />
      ))}
    </svg>
  )
}

// ─── ServiceCard ───────────────────────────────────────────────────────────

interface Props {
  id: string
  name: string
  checkUrl?: string
  initialState: ServiceStatusState
  uptime: UptimeResult
}

export function ServiceCard({ id, name, checkUrl, initialState, uptime }: Props) {
  const [state, setState] = useState<ServiceStatusState>(initialState)

  // Realtime status via onSnapshot — lazy imported to avoid SSR issues
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    Promise.all([
      import('@/lib/firebase/client'),
      import('firebase/firestore'),
    ]).then(async ([{ clientApp, waitForAuth }, firestore]) => {
      await waitForAuth()
      if (!active) return
      const db = firestore.getFirestore(clientApp)
      unsubscribe = firestore.onSnapshot(
        firestore.doc(db, 'services', id),
        (snap) => {
          if (!active) return
          const data = snap.data()
          if (data?.currentStatus?.state) {
            setState(data.currentStatus.state as ServiceStatusState)
          }
        },
      )
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [id])

  const isDown = state === 'major-outage' || state === 'partial-outage'
  const uptimeColor = isDown ? 'var(--color-danger)' : 'var(--color-success)'

  return (
    <Link
      href={`/admin/services/${id}`}
      className="block p-4 rounded-[var(--radius)] bg-[var(--card)] [box-shadow:var(--shadow-card)] active:scale-[0.98] transition-all card-lift"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <StatusDot state={state} />
          <span className="text-[15px] font-medium leading-snug truncate">
            {name}
          </span>
        </div>
        <span
          className="text-[13px] font-medium tabular-nums shrink-0"
          style={{ color: uptimeColor }}
        >
          {uptime.uptimePct.toFixed(2)}%
        </span>
      </div>

      {/* URL sub-label */}
      {checkUrl && (
        <p
          className="text-[12px] truncate mt-0.5 pl-[1.125rem]"
          style={{ color: 'var(--color-fg-faint)' }}
        >
          {checkUrl}
        </p>
      )}

      {/* Sparkline */}
      <div className="mt-3">
        <Sparkline segments={uptime.segments} />
      </div>
    </Link>
  )
}
