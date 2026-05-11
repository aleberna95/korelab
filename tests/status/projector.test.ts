/**
 * Unit tests for the status page projector.
 *
 * Key goal: verify the return type has EXACTLY the required keys (no extra fields leak).
 * Run: npx vitest run tests/status/projector.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  projectServiceForStatus,
  type PublicServiceView,
} from '@/lib/status/projector'

// ─── TypeScript-level exhaustive field check ──────────────────────────────
// If any key is added to PublicServiceView that isn't accounted for in this
// type assertion, this file will fail to compile.
type AllExpectedKeys = keyof PublicServiceView
type _ = Exclude<
  AllExpectedKeys,
  'name' | 'state' | 'since' | 'uptime30d' | 'daily90d' | 'activeIncident' | 'recentIncidents' | 'maintenance' | 'latestReport'
>
// If the Exclude above produces `never`, we're good. Assert it at the value level:
const _typeCheck: _ extends never ? true : false = true as const
void _typeCheck

// ─── Mock helpers ─────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase-admin/firestore'

function fakeTs(d: Date) {
  return { toDate: () => d, toMillis: () => d.getTime() } as unknown as Timestamp
}

import type { Service, Incident } from '@/lib/domain/types'

const BASE_SERVICE: Service = {
  id: 'svc1',
  clientId: 'cl1',
  name: 'Acme Website',
  type: 'static-site',
  environment: 'production',
  criticality: 'high',
  tags: [],
  description: '',
  url: 'https://acme.example.com',
  statusPageVisibility: 'public',
  currentStatus: { state: 'operational', since: fakeTs(new Date('2026-05-01')), uptime30d: 99.95 },
  monitorIds: [],
  createdAt: fakeTs(new Date()),
  updatedAt: fakeTs(new Date()),
}

const ROLLUPS = [
  { date: '2026-05-08', uptimePct: 100, downtimeSec: 0, checks: 1440, downChecks: 0, incidentCount: 0 },
  { date: '2026-05-09', uptimePct: 98.5, downtimeSec: 1296, checks: 1440, downChecks: 3, incidentCount: 1 },
  { date: '2026-05-10', uptimePct: 100, downtimeSec: 0, checks: 720, downChecks: 0, incidentCount: 0 },
]

const INCIDENT_PUBLIC: Incident = {
  id: 'inc1',
  serviceId: 'svc1',
  clientId: 'cl1',
  state: 'resolved',
  severity: 'minor',
  startedAt: fakeTs(new Date('2026-05-09T08:00:00Z')),
  resolvedAt: fakeTs(new Date('2026-05-09T08:21:36Z')),
  source: 'internal-check',
  title: 'Elevated error rate',
  publicMessage: 'We detected elevated errors. Issue resolved.',
  visibility: 'public',
  notifiedClient: false,
  metrics: { downtimeSec: 1296 },
}

const INCIDENT_PRIVATE: Incident = {
  ...INCIDENT_PUBLIC,
  id: 'inc2',
  visibility: 'private',
  title: 'Internal db lag',
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('projectServiceForStatus', () => {
  it('returns only the allowed top-level keys', () => {
    const view = projectServiceForStatus(BASE_SERVICE, [], [], ['status'])
    const keys = Object.keys(view).sort()
    expect(keys).toEqual([
      'activeIncident',
      'daily90d',
      'name',
      'recentIncidents',
      'since',
      'state',
      'uptime30d',
    ])
  })

  it('maps service name and state correctly', () => {
    const view = projectServiceForStatus(BASE_SERVICE, [], [], ['status'])
    expect(view.name).toBe('Acme Website')
    expect(view.state).toBe('operational')
    expect(view.uptime30d).toBe(99.95)
  })

  it('includes daily90d from rollups', () => {
    const view = projectServiceForStatus(BASE_SERVICE, [], ROLLUPS, ['status'])
    expect(view.daily90d).toHaveLength(3)
    expect(view.daily90d[0]).toEqual({ date: '2026-05-08', uptimePct: 100 })
  })

  it('hides public incidents when incidents section not allowed', () => {
    const view = projectServiceForStatus(BASE_SERVICE, [INCIDENT_PUBLIC], ROLLUPS, ['status'])
    expect(view.recentIncidents).toHaveLength(0)
    expect(view.activeIncident).toBeUndefined()
  })

  it('includes public incidents when incidents section allowed', () => {
    const view = projectServiceForStatus(
      BASE_SERVICE,
      [INCIDENT_PUBLIC],
      ROLLUPS,
      ['status', 'incidents'],
    )
    expect(view.recentIncidents).toHaveLength(1)
    expect(view.recentIncidents[0].title).toBe('Elevated error rate')
    // Private message must not appear
    expect(JSON.stringify(view.recentIncidents[0])).not.toContain('private')
  })

  it('excludes private-visibility incidents even if incidents section allowed', () => {
    const view = projectServiceForStatus(
      BASE_SERVICE,
      [INCIDENT_PRIVATE],
      ROLLUPS,
      ['status', 'incidents'],
    )
    expect(view.recentIncidents).toHaveLength(0)
  })

  it('shows active incident correctly', () => {
    const activeInc: Incident = {
      ...INCIDENT_PUBLIC,
      id: 'inc3',
      state: 'investigating',
    }
    const view = projectServiceForStatus(
      BASE_SERVICE,
      [activeInc],
      [],
      ['status', 'incidents'],
    )
    expect(view.activeIncident).toBeDefined()
    expect(view.activeIncident!.title).toBe('Elevated error rate')
  })

  it('caps daily90d at 90 entries', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      date: `2026-0${String(i % 9 + 1).padStart(2, '0')}-01`,
      uptimePct: 100,
      downtimeSec: 0,
      checks: 1440,
      downChecks: 0,
      incidentCount: 0,
    }))
    const view = projectServiceForStatus(BASE_SERVICE, [], many, ['status'])
    expect(view.daily90d.length).toBeLessThanOrEqual(90)
  })

  it('does not expose rootCause, privateMessage, resolution, or access fields', () => {
    const inc: import('@/lib/domain/types').Incident = {
      ...INCIDENT_PUBLIC,
      rootCause: 'DB OOM',
      privateMessage: 'Secret details',
      resolution: 'Restarted pod',
    }
    const view = projectServiceForStatus(BASE_SERVICE, [inc], [], ['status', 'incidents'])
    const json = JSON.stringify(view)
    expect(json).not.toContain('rootCause')
    expect(json).not.toContain('privateMessage')
    expect(json).not.toContain('resolution')
  })
})
