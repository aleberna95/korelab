import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UptimeSegment {
  /** Unix ms — start of downtime window */
  start: number
  /** Unix ms — end of downtime window */
  end: number
}

export interface UptimeResult {
  /** 0–100, clamped */
  uptimePct: number
  /** Total milliseconds of downtime in the window */
  downMs: number
  /** Individual downtime segments (clipped to window) */
  segments: UptimeSegment[]
}

// ─── Pure calculation (exported for testing) ───────────────────────────────

/** Minimal incident shape needed for calculation — compatible with Firestore Timestamp */
export interface RawIncident {
  startedAt: { toMillis(): number }
  resolvedAt?: { toMillis(): number } | null
}

/**
 * Calculates uptime from a list of raw incidents within [windowStart, windowEnd].
 * Pure function — no I/O. Exported for unit testing.
 *
 * Negative model: absence of incident = up.
 * Ongoing incident (no resolvedAt) counts until windowEnd.
 */
export function calculateUptime(
  incidents: RawIncident[],
  windowStart: number,
  windowEnd: number,
): UptimeResult {
  const totalMs = windowEnd - windowStart
  if (totalMs <= 0) return { uptimePct: 100, downMs: 0, segments: [] }

  let downMs = 0
  const segments: UptimeSegment[] = []

  for (const inc of incidents) {
    const start = Math.max(inc.startedAt.toMillis(), windowStart)
    const end = Math.min(inc.resolvedAt?.toMillis() ?? windowEnd, windowEnd)
    if (end > start) {
      downMs += end - start
      segments.push({ start, end })
    }
  }

  const uptimePct = Math.max(0, Math.min(100, ((totalMs - downMs) / totalMs) * 100))
  return { uptimePct, downMs, segments }
}

// ─── In-memory cache ───────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  result: UptimeResult
  expiresAt: number
}

const _cache = new Map<string, CacheEntry>()

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Computes uptime % and downtime segments for a service over the last `days` days.
 * Results are cached in-memory for 60 seconds.
 */
export async function computeUptime(serviceId: string, days = 30): Promise<UptimeResult> {
  const now = Date.now()
  const key = `${serviceId}:${days}`

  const cached = _cache.get(key)
  if (cached && now < cached.expiresAt) {
    return cached.result
  }

  const since = now - days * 86_400_000
  const db = getAdminDb()

  const snap = await db
    .collection('incidents')
    .where('serviceId', '==', serviceId)
    .where('startedAt', '>=', Timestamp.fromMillis(since))
    .orderBy('startedAt', 'asc')
    .get()

  const rawIncidents = snap.docs.map((doc) => doc.data() as RawIncident)
  const result = calculateUptime(rawIncidents, since, now)

  _cache.set(key, { result, expiresAt: now + CACHE_TTL_MS })

  return result
}
