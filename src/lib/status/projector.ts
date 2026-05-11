/**
 * projector.ts — Single source of truth for what fields are exposed on public/tokenized status pages.
 *
 * projectServiceForStatus() produces a PublicServiceView with an EXACT set of keys.
 * Any internal field that is NOT listed here must NEVER appear in the output.
 *
 * The function is pure (no I/O) so it can be tested exhaustively without Firestore.
 */

import type { Service, Incident } from '@/lib/domain/types'

type DailyRollupLike = { date: string; uptimePct: number; [k: string]: unknown }

// ─── Strict output type ────────────────────────────────────────────────────

export type DailyBar = {
  date: string
  uptimePct: number
}

export type PublicIncident = {
  title: string
  publicMessage: string
  startedAt: Date
  resolvedAt?: Date
  downtimeSec?: number
  severity: 'minor' | 'major' | 'critical'
}

export type PublicServiceView = {
  name: string
  state: string
  since: Date
  uptime30d: number
  daily90d: DailyBar[]
  activeIncident?: PublicIncident
  recentIncidents: PublicIncident[]
}

// ── Allowed sections ──────────────────────────────────────────────────────────────

export type AllowedSection = 'status' | 'incidents'

// ─── Projector ────────────────────────────────────────────────────────────

function tsToDate(ts: { toDate(): Date } | undefined): Date {
  return ts?.toDate() ?? new Date(0)
}

export function projectServiceForStatus(
  service: Service,
  incidents: Incident[],
  dailyRollups: DailyRollupLike[],
  allowedSections: AllowedSection[],
): PublicServiceView {
  const allowed = new Set(allowedSections)

  // ── status (always included as base) ─────────────────────────────────────
  const daily90d: DailyBar[] = dailyRollups
    .slice(-90)
    .map((r) => ({ date: r.date, uptimePct: r.uptimePct }))

  // ── incidents ─────────────────────────────────────────────────────────────
  let activeIncident: PublicServiceView['activeIncident'] = undefined
  let recentIncidents: PublicServiceView['recentIncidents'] = []

  if (allowed.has('incidents')) {
    const visibleIncidents = incidents.filter(
      (i) => i.visibility === 'public' || i.visibility === 'tokenized',
    )

    const active = visibleIncidents.find(
      (i) => i.state === 'investigating' || i.state === 'identified' || i.state === 'monitoring',
    )

    if (active) {
      activeIncident = {
        title: active.title,
        publicMessage: active.publicMessage ?? '',
        startedAt: tsToDate(active.startedAt as unknown as { toDate(): Date }),
        severity: active.severity,
      }
    }

    recentIncidents = visibleIncidents
      .filter((i) => i.state === 'resolved')
      .slice(0, 10)
      .map((i) => ({
        title: i.title,
        publicMessage: i.publicMessage ?? '',
        startedAt: tsToDate(i.startedAt as unknown as { toDate(): Date }),
        resolvedAt: i.resolvedAt
          ? tsToDate(i.resolvedAt as unknown as { toDate(): Date })
          : undefined,
        downtimeSec: i.metrics.downtimeSec,
        severity: i.severity,
      }))
  }

  // ── Return ONLY the allowed fields ───────────────────────────────────────
  const view: PublicServiceView = {
    name: service.name,
    state: service.currentStatus.state,
    since: tsToDate(service.currentStatus.since as unknown as { toDate(): Date }),
    uptime30d: service.currentStatus.uptime30d ?? 100,
    daily90d,
    activeIncident,
    recentIncidents,
  }

  return view
}
