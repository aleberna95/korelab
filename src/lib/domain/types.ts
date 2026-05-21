import 'server-only'
import type { Timestamp } from 'firebase-admin/firestore'

// ─── Client ────────────────────────────────────────────────────────────────

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

// ─── Service ───────────────────────────────────────────────────────────────

export type ServiceType =
  | 'static-site'
  | 'landing'
  | 'corporate-site'
  | 'ecommerce'
  | 'saas'
  | 'api'
  | 'mobile-backend'
  | 'firebase-project'
  | 'domain'
  | 'other'

export type ServiceStatusState =
  | 'operational'
  | 'degraded'
  | 'partial-outage'
  | 'major-outage'
  | 'maintenance'
  | 'unknown'

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
  type: ServiceType
  environment: 'production' | 'staging' | 'dev'
  criticality: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  description: string
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

// ─── Incident ──────────────────────────────────────────────────────────────

export type IncidentState =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'false-positive'

export type IncidentSeverity = 'minor' | 'major' | 'critical'

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
  privateMessage?: string
  rootCause?: string
  resolution?: string
  metrics: { downtimeSec?: number }
}

export interface IncidentTimelineEvent {
  id: string
  at: Timestamp
  kind: 'detected' | 'updated' | 'comment' | 'resolved' | 'reopened'
  message: string
  byUid?: string
}

// ─── Task ──────────────────────────────────────────────────────────────────

export type TaskColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'gray'

export interface Task {
  id: string
  /** Free-form text content, max 2000 chars */
  text: string
  color: TaskColor
  /** Integer sort key, descending (higher = top). Midpoint reorder; rebalance if delta < 1. */
  order: number
  done: boolean
  doneAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}


