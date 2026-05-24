import 'server-only'

// ─── Client ────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  vatNumber?: string    // Partita IVA
  taxCode?: string      // Codice fiscale
  address?: string      // Indirizzo sede legale
  pec?: string          // PEC
  sdi?: string          // Codice SDI
  notes?: string
  tags: string[]
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
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
    since: string
    activeIncidentId?: string
    lastCheckAt?: string
    uptime30d?: number
  }
  createdAt: string
  updatedAt: string
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
  startedAt: string
  resolvedAt?: string
  source: 'internal-check' | 'manual'
  title: string
  privateMessage?: string
  rootCause?: string
  resolution?: string
  metrics: { downtimeSec?: number }
}

export interface IncidentTimelineEvent {
  id: string
  at: string
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
  doneAt?: string
  clientIds?: string[]
  serviceIds?: string[]
  createdAt: string
  updatedAt: string
}


