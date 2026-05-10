/**
 * dailyRollup — scheduled daily at 00:05 UTC.
 *
 * For each active service that has at least one monitor:
 * 1. Read all uptimeSamples from the previous calendar day (UTC)
 * 2. Compute uptimePct, downtimeSec, incidentCount, avgResponseMs, checks, downChecks
 * 3. Write to services/{serviceId}/daily/{YYYY-MM-DD}
 *
 * Idempotent: the doc key is the date — re-running on the same day overwrites cleanly.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import type { DailyRollup } from '../lib/types'

if (!getApps().length) initializeApp()

const db = getFirestore()

/** Returns { fromMs, toMs } for the previous UTC calendar day */
function previousDayRange(): { date: string; from: Date; to: Date } {
  const now = new Date()
  // Go to start of today UTC, then subtract 1 day
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const startOfYesterday = startOfToday - 86_400_000

  const from = new Date(startOfYesterday)
  const to = new Date(startOfToday - 1) // 23:59:59.999 yesterday

  const y = from.getUTCFullYear()
  const m = String(from.getUTCMonth() + 1).padStart(2, '0')
  const d = String(from.getUTCDate()).padStart(2, '0')

  return { date: `${y}-${m}-${d}`, from, to }
}

export const dailyRollup = onSchedule(
  { schedule: '5 0 * * *', timeZone: 'UTC', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    const { date, from, to } = previousDayRange()

    const fromTs = Timestamp.fromDate(from)
    const toTs = Timestamp.fromDate(to)

    // 1. Find all services with at least one monitor
    const servicesSnap = await db
      .collection('services')
      .where('monitorIds', '!=', [])
      .get()

    console.log(`dailyRollup: processing ${servicesSnap.size} services for ${date}`)

    const batch = db.batch()
    let batchCount = 0
    const BATCH_LIMIT = 450 // Firestore batch max 500, stay safe

    for (const serviceDoc of servicesSnap.docs) {
      const serviceId = serviceDoc.id
      const clientId = (serviceDoc.data() as { clientId: string }).clientId

      // 2. Fetch uptimeSamples for this service during the day window
      const samplesSnap = await db
        .collection('uptimeSamples')
        .where('serviceId', '==', serviceId)
        .where('recordedAt', '>=', fromTs)
        .where('recordedAt', '<=', toTs)
        .get()

      const samples = samplesSnap.docs.map((d) => d.data() as {
        result: 'up' | 'down' | 'degraded'
        responseMs?: number
        recordedAt: Timestamp
      })

      const checks = samples.length
      const downChecks = samples.filter((s) => s.result === 'down').length
      const uptimePct = checks > 0 ? ((checks - downChecks) / checks) * 100 : 100
      const downtimeSec = checks > 0
        ? Math.round((downChecks / checks) * 86_400)
        : 0

      // Average response time (up samples only)
      const upWithMs = samples.filter((s) => s.result === 'up' && s.responseMs != null)
      const avgResponseMs = upWithMs.length > 0
        ? Math.round(upWithMs.reduce((sum, s) => sum + (s.responseMs ?? 0), 0) / upWithMs.length)
        : undefined

      // 3. Count incidents that started during the day
      const incSnap = await db
        .collection('incidents')
        .where('serviceId', '==', serviceId)
        .where('startedAt', '>=', fromTs)
        .where('startedAt', '<=', toTs)
        .get()

      const incidentCount = incSnap.size

      // 4. Write rollup
      const rollup: DailyRollup = {
        date,
        uptimePct: Math.min(100, Math.max(0, uptimePct)),
        downtimeSec,
        incidentCount,
        checks,
        downChecks,
        ...(avgResponseMs !== undefined && { avgResponseMs }),
      }

      const ref = db
        .collection('services')
        .doc(serviceId)
        .collection('daily')
        .doc(date)

      batch.set(ref, { ...rollup, serviceId, clientId })

      batchCount++

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit()
        batchCount = 0
        console.log(`dailyRollup: committed intermediate batch`)
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    console.log(`dailyRollup: complete for ${date}`)
  },
)
