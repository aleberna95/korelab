import { Timestamp } from 'firebase-admin/firestore'

// ─── Shared ────────────────────────────────────────────────────────────────

export type SupportPlan = 'monitor-only' | 'managed' | 'full'

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

export type MonitorSource =
  | 'internal-http'
  | 'internal-ssl'

// ─── Documents ─────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  businessType: 'agency' | 'ecommerce' | 'corporate' | 'startup' | 'other'
  contacts: Array<{ name: string; email: string; phone?: string; role: string; primary: boolean }>
  telegramChatId?: string
  supportPlan: SupportPlan
  consent: {
    monitoring: boolean
    notification: boolean
  }
  tags: string[]
  status: 'active' | 'paused' | 'archived'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Service {
  id: string
  clientId: string
  name: string
  type: string
  environment: 'production' | 'staging' | 'dev'
  criticality: 'low' | 'medium' | 'high' | 'critical'
  url?: string
  healthcheckUrl?: string
  statusPageVisibility: 'private' | 'tokenized' | 'public'
  currentStatus: {
    state: ServiceStatusState
    since: Timestamp
    activeIncidentId?: string
    lastCheckAt?: Timestamp
    uptime30d?: number
  }
  monitorIds: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Monitor {
  id: string
  serviceId: string
  clientId: string
  source: MonitorSource
  config: {
    intervalSec: number
    url?: string
    timeoutMs?: number
    expectStatus?: number
    expectBody?: string
  }
  alertChannels: {
    telegram: boolean
    clientNotify: boolean
  }
  active: boolean
  lastCheckAt?: Timestamp
  lastResult?: 'up' | 'down' | 'degraded'
  /** Threshold days already alerted (SSL ladder) */
  alertedThresholds?: number[]
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
  publicMessage?: string
  notifiedClient: boolean
  metrics: { downtimeSec?: number }
}

export interface IncidentTimelineEvent {
  id: string
  at: Timestamp
  kind: 'detected' | 'updated' | 'comment' | 'resolved' | 'reopened'
  message: string
  byUid?: string
}

export interface MaintenanceWindow {
  id: string
  serviceIds: string[]
  clientId: string
  startsAt: Timestamp
  endsAt: Timestamp
  suppressIncidents: boolean
}

export interface AuditLog {
  id: string
  at: Timestamp
  actorUid?: string
  actorKind: 'user' | 'function' | 'webhook'
  action: string
  targetCollection: string
  targetId: string
  metadata?: Record<string, unknown>
  ip?: string
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

// ─── Webhook payloads ──────────────────────────────────────────────────────

/** UptimeRobot webhook POST body (simplified subset we care about) */
export interface UptimeRobotWebhookPayload {
  monitorID: string | number
  monitorURL: string
  monitorFriendlyName: string
  alertType: number      // 1=down, 2=up
  alertTypeFriendlyName: string
  alertDetails: string
  alertDuration: number  // seconds down (when alert is "up")
  monitorAlertContacts: string
}
