/**
 * UptimeRobot API types — used by both the Cloud Function client and the webhook normalizer.
 *
 * Reference: https://uptimerobot.com/api/
 */

// ─── Monitor types (UptimeRobot constants) ─────────────────────────────────

export const UR_TYPE = {
  HTTP: 1,
  KEYWORD: 2,
  PING: 3,
  PORT: 4,
} as const

export const UR_STATUS = {
  PAUSED: 0,
  NOT_CHECKED_YET: 1,
  UP: 2,
  SEEMS_DOWN: 8,
  DOWN: 9,
} as const

export const UR_ALERT_TYPE = {
  DOWN: 1,
  UP: 2,
  /** Monitor paused due to too many alerts */
  PAUSED: 99,
} as const

// ─── API response shapes ───────────────────────────────────────────────────

export type UrMonitor = {
  id: number
  friendly_name: string
  url: string
  type: number
  status: number
  interval: number
  keyword_type?: number
  keyword_value?: string
  http_username?: string
  http_password?: string
  http_auth_type?: number
  http_method?: number
  post_value?: string
  port?: number
  /** comma-separated alert contact IDs */
  alert_contacts?: string
  create_datetime?: number
}

export type UrApiResponse<T> = {
  stat: 'ok' | 'fail'
  error?: { type: string; message: string }
} & T

export type GetMonitorsResponse = UrApiResponse<{
  pagination?: { offset: number; limit: number; total: number }
  monitors: UrMonitor[]
}>

export type NewMonitorResponse = UrApiResponse<{
  monitor: { id: number }
}>

export type EditMonitorResponse = UrApiResponse<{
  monitor: { id: number }
}>

export type DeleteMonitorResponse = UrApiResponse<{
  monitor: { id: number }
}>

// ─── Webhook payload ────────────────────────────────────────────────────────

/** Raw UptimeRobot webhook POST body (form-encoded or JSON) */
export type UrWebhookPayload = {
  monitorID: string
  monitorURL: string
  monitorFriendlyName: string
  alertType: string            // "1" = down, "2" = up, "99" = paused
  alertTypeFriendlyName: string
  alertDetails: string
  alertDuration?: string       // seconds — only present for "up" alerts
  alertDateTime?: string       // ISO-like string from UptimeRobot
  responseTime?: string        // ms
  /** Opaque event identifier from UptimeRobot for idempotency */
  externalEventId?: string
}

// ─── Normalized event (our internal format) ────────────────────────────────

export type NormalizedMonitorEvent = {
  monitorId: string           // Firestore monitor doc ID
  serviceId: string           // Firestore service doc ID
  externalMonitorId: string   // UptimeRobot monitor ID
  externalEventId: string     // for idempotency dedup
  kind: 'up' | 'down' | 'paused'
  at: Date
  responseTimeMs?: number
  statusCode?: number
  details?: string
}
