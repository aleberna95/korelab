/**
 * Normalize a raw UptimeRobot webhook payload into our internal event format.
 *
 * UptimeRobot sends form-encoded POST bodies. The alertType field maps to:
 *   1 → down
 *   2 → up
 *  99 → paused (too many alerts)
 *
 * externalEventId is derived from (monitorID + alertType + alertDateTime) when
 * UptimeRobot doesn't send an explicit one, giving us a stable dedup key.
 */

export type RawUrPayload = {
  monitorID?: string | number
  monitorURL?: string
  monitorFriendlyName?: string
  alertType?: string | number
  alertTypeFriendlyName?: string
  alertDetails?: string
  alertDuration?: string | number
  alertDateTime?: string
  responseTime?: string | number
}

export type NormalizedEvent = {
  externalMonitorId: string
  kind: 'up' | 'down' | 'paused'
  at: Date
  responseTimeMs?: number
  details?: string
  /** Stable dedup key derived from payload fields */
  externalEventId: string
}

/** Parse an alert type number to our internal kind */
function parseKind(alertType: string | number | undefined): NormalizedEvent['kind'] {
  const t = Number(alertType)
  if (t === 2) return 'up'
  if (t === 99) return 'paused'
  return 'down' // 1 = down, default
}

/** Parse the alertDateTime string from UptimeRobot (or fall back to now). */
function parseAt(alertDateTime: string | undefined): Date {
  if (!alertDateTime) return new Date()
  const ts = Date.parse(alertDateTime)
  return isNaN(ts) ? new Date() : new Date(ts)
}

/** Build a deterministic externalEventId from the payload fields we trust. */
function buildEventId(raw: RawUrPayload): string {
  const parts = [
    String(raw.monitorID ?? 'unknown'),
    String(raw.alertType ?? '0'),
    raw.alertDateTime ?? new Date().toISOString(),
  ]
  return parts.join('::')
}

export function normalizeUrPayload(raw: RawUrPayload): NormalizedEvent {
  return {
    externalMonitorId: String(raw.monitorID ?? ''),
    kind: parseKind(raw.alertType),
    at: parseAt(raw.alertDateTime),
    responseTimeMs:
      raw.responseTime !== undefined && raw.responseTime !== ''
        ? Number(raw.responseTime)
        : undefined,
    details: raw.alertDetails,
    externalEventId: buildEventId(raw),
  }
}
