import { Timestamp } from 'firebase-admin/firestore'

// ─── Shared ────────────────────────────────────────────────────────────────

export type ServiceStatusState =
  | 'operational'
  | 'degraded'
  | 'partial-outage'
  | 'major-outage'
  | 'maintenance'
  | 'unknown'

export type IncidentState =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'false-positive'

export type IncidentSeverity = 'minor' | 'major' | 'critical'



// ─── Documents ─────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  notes?: string
  tags: string[]
  status: 'active' | 'archived'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ServiceCheck {
  enabled: boolean
  url: string
  intervalSec: number
  timeoutMs: number
  expectStatus?: number
  expectBody?: string
  sslCheck: boolean
  sslAlertDays: number[]
  alertedThresholds?: number[]
}

export interface Service {
  id: string
  clientId: string
  name: string
  type: string
  environment: 'production' | 'staging' | 'dev'
  criticality: 'low' | 'medium' | 'high' | 'critical'
  url?: string
  check?: ServiceCheck
  currentStatus: {
    state: ServiceStatusState
    since: Timestamp
    activeIncidentId?: string
    lastCheckAt?: Timestamp
    uptime30d?: number
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}



export interface Incident {
  id: string
  serviceId: string
  clientId: string
  state: IncidentState
  severity: IncidentSeverity
  startedAt: Timestamp
  resolvedAt?: Timestamp
  source: 'internal-check' | 'manual'
  title: string
  metrics: { downtimeSec?: number }
}

export interface IncidentTimelineEvent {
  id: string
  at: Timestamp
  kind: 'detected' | 'updated' | 'comment' | 'resolved' | 'reopened'
  message: string
  byUid?: string
}



export interface DailyRollup {
  date: string // YYYY-MM-DD
  uptimePct: number
  downtimeSec: number
  incidentCount: number
  avgResponseMs?: number
  checks: number
  downChecks: number
}


