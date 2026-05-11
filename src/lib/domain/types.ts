import 'server-only'
import type { Timestamp } from 'firebase-admin/firestore'

// ─── Shared sub-types ──────────────────────────────────────────────────────

export type SupportPlan = 'monitor-only' | 'managed' | 'full'

export type Contact = {
  name: string
  email: string
  phone?: string
  role: string
  primary: boolean
}

// ─── Client ────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  businessType: 'agency' | 'ecommerce' | 'corporate' | 'startup' | 'other'
  contacts: Contact[]
  telegramChatId?: string
  supportPlan: SupportPlan
  consent: {
    monitoring: boolean
    notification: boolean
  }
  tags: string[]
  notes: string
  status: 'active' | 'paused' | 'archived'
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

// ─── Resource ──────────────────────────────────────────────────────────────

export type ResourceKind =
  | 'db'
  | 'ssl-cert'
  | 'domain'
  | 'repo'
  | 'firebase-project'
  | 'other'

export interface Resource {
  id: string
  kind: ResourceKind
  name: string
  clientId?: string
  metadata: Record<string, unknown>
  secretRefIds: string[]
  tags: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Dependency ────────────────────────────────────────────────────────────

export interface Dependency {
  id: string
  fromId: string
  fromKind: 'service' | 'resource'
  toId: string
  toKind: 'service' | 'resource'
  type: 'depends-on' | 'deploys-to' | 'uses' | 'routes-to'
  createdAt: Timestamp
}

// ─── Monitor ───────────────────────────────────────────────────────────────

export type MonitorSource =
  | 'internal-http'
  | 'internal-ssl'

export interface Monitor {
  id: string
  serviceId: string
  clientId: string
  source: MonitorSource
  externalId?: string
  config: {
    intervalSec: number
    url?: string
    timeoutMs?: number
    expectStatus?: number
    expectBody?: string
  }
  alertChannels: {
    telegram: boolean
    email: boolean
    clientNotify: boolean
  }
  active: boolean
  lastCheckAt?: Timestamp
  lastResult?: 'up' | 'down' | 'degraded'
  /** Used by alertLadder to track which thresholds have been triggered */
  alertedThresholds?: number[]
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
  publicMessage?: string
  privateMessage?: string
  rootCause?: string
  resolution?: string
  visibility: 'private' | 'tokenized' | 'public'
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

// ─── Maintenance Window ────────────────────────────────────────────────────

export interface MaintenanceWindow {
  id: string
  serviceIds: string[]
  clientId: string
  title: string
  publicMessage: string
  startsAt: Timestamp
  endsAt: Timestamp
  suppressIncidents: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Runbook ───────────────────────────────────────────────────────────────

export interface Runbook {
  id: string
  title: string
  serviceTypes: string[]
  appliesToTags: string[]
  firstChecks: string[]
  contacts: string[]
  commonFailures: Array<{ symptom: string; likelyCause: string; fix: string }>
  recoverySteps: Array<{
    title: string
    body: string
    riskLevel: 'low' | 'medium' | 'high'
  }>
  links: string[]
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Task ──────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description: string
  serviceId?: string
  incidentId?: string
  runbookId?: string
  runbookStepIndex?: number
  state: 'todo' | 'doing' | 'done' | 'cancelled'
  dueAt?: Timestamp
  createdAt: Timestamp
  completedAt?: Timestamp
  notes: string
}

// ─── Report ────────────────────────────────────────────────────────────────

export interface Report {
  id: string
  serviceId: string
  clientId: string
  period: {
    kind: 'monthly' | 'custom'
    from: Timestamp
    to: Timestamp
    label: string
  }
  metrics: {
    uptimePct: number
    downtimeSec: number
    incidentCount: number
    mttrSec?: number
    avgResponseMs?: number
    checks: number
  }
  incidents: Array<{
    id: string
    title: string
    startedAt: Timestamp
    resolvedAt?: Timestamp
    downtimeSec?: number
    severity: IncidentSeverity
    publicMessage?: string
  }>
  maintenance: Array<{
    id: string
    startsAt: Timestamp
    endsAt: Timestamp
    title: string
  }>
  notes: { client?: string; private?: string }
  visibility: 'private' | 'tokenized' | 'email'
  generatedAt: Timestamp
  generatedBy: 'auto' | 'manual'
  generatedByUid?: string
}

// ─── StatusToken ───────────────────────────────────────────────────────────

export interface StatusToken {
  id: string
  /** sha256(rawToken) */
  tokenHash: string
  scope: 'client' | 'service'
  targetId: string
  expiresAt?: Timestamp
  revokedAt?: Timestamp
  allowedSections: Array<'status' | 'incidents' | 'reports' | 'maintenance'>
  createdAt: Timestamp
  createdBy: string
  lastUsedAt?: Timestamp
}

// ─── AuditLog ──────────────────────────────────────────────────────────────

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

// ─── SecretRef ─────────────────────────────────────────────────────────────

export interface SecretRef {
  id: string
  name: string
  kind: 'ssh-key' | 'api-key' | 'oauth-token' | 'service-account' | 'db-credentials' | 'other'
  /** Full Secret Manager resource name — NEVER the actual secret */
  secretManagerRef: string
  clientId?: string
  resourceId?: string
  description: string
  lastRotatedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── DailyRollup ───────────────────────────────────────────────────────────

export interface DailyRollup {
  date: string // YYYY-MM-DD
  uptimePct: number
  downtimeSec: number
  incidentCount: number
  avgResponseMs?: number
  checks: number
  downChecks: number
}
