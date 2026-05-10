/**
 * generateMonthlyReports — scheduled on the 1st of each month at 01:00 UTC.
 *
 * For each active service with supportPlan that includes reporting:
 * 1. Compute the previous calendar month range
 * 2. Aggregate daily rollups for the month
 * 3. Collect incidents and maintenance windows for the month
 * 4. Write a Report document via the reports collection
 *
 * Idempotent: if a report for the period already exists (serviceId + period.from),
 * it is skipped.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import type { DailyRollup } from '../lib/types'

if (!getApps().length) initializeApp()

const db = getFirestore()

/** Plans eligible for auto-generated monthly reports */
const REPORTING_PLANS = new Set([
  'reporting-only',
  'managed-support',
  'managed-infra',
  'auto-healing',
])

/** Returns the previous calendar month range in UTC */
function previousMonthRange(): { from: Date; to: Date; label: string } {
  const now = new Date()
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1

  const from = new Date(Date.UTC(year, month, 1))
  const to = new Date(Date.UTC(year, month + 1, 1) - 1) // last ms of last day

  const monthName = from.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const label = `${monthName} ${year}`

  return { from, to, label }
}

export const generateMonthlyReports = onSchedule(
  { schedule: '0 1 1 * *', timeZone: 'UTC', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    const { from, to, label } = previousMonthRange()
    const fromTs = Timestamp.fromDate(from)
    const toTs = Timestamp.fromDate(to)

    console.log(`generateMonthlyReports: period "${label}" (${from.toISOString()} → ${to.toISOString()})`)

    // 1. Load clients with a reporting-eligible support plan
    const clientsSnap = await db
      .collection('clients')
      .where('supportPlan', 'in', [...REPORTING_PLANS])
      .where('status', '==', 'active')
      .get()

    for (const clientDoc of clientsSnap.docs) {
      const clientId = clientDoc.id

      // 2. Load services for this client
      const servicesSnap = await db
        .collection('services')
        .where('clientId', '==', clientId)
        .get()

      for (const serviceDoc of servicesSnap.docs) {
        const serviceId = serviceDoc.id

        // 3. Idempotency check — skip if report already exists for this period
        const existingSnap = await db
          .collection('reports')
          .where('serviceId', '==', serviceId)
          .where('period.from', '==', fromTs)
          .limit(1)
          .get()

        if (!existingSnap.empty) {
          console.log(`generateMonthlyReports: skipping ${serviceId} (report already exists)`)
          continue
        }

        // 4. Aggregate daily rollups for the month
        const rollupSnap = await db
          .collection('services')
          .doc(serviceId)
          .collection('daily')
          .where('date', '>=', from.toISOString().slice(0, 10))
          .where('date', '<=', to.toISOString().slice(0, 10))
          .orderBy('date', 'asc')
          .get()

        const rollups = rollupSnap.docs.map((d) => d.data() as DailyRollup)

        const totalChecks = rollups.reduce((s, r) => s + r.checks, 0)
        const totalDown = rollups.reduce((s, r) => s + r.downChecks, 0)
        const uptimePct = totalChecks > 0
          ? Math.min(100, ((totalChecks - totalDown) / totalChecks) * 100)
          : 100
        const downtimeSec = rollups.reduce((s, r) => s + r.downtimeSec, 0)
        const incidentCount = rollups.reduce((s, r) => s + r.incidentCount, 0)

        const upWithMs = rollups.filter((r) => r.avgResponseMs != null)
        const avgResponseMs = upWithMs.length > 0
          ? Math.round(upWithMs.reduce((s, r) => s + (r.avgResponseMs ?? 0), 0) / upWithMs.length)
          : undefined

        // 5. Collect incidents during the month
        const incidentsSnap = await db
          .collection('incidents')
          .where('serviceId', '==', serviceId)
          .where('startedAt', '>=', fromTs)
          .where('startedAt', '<=', toTs)
          .orderBy('startedAt', 'asc')
          .get()

        const incidentSummaries = incidentsSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: data.title as string,
            startedAt: (data.startedAt as Timestamp).toDate().toISOString(),
            resolvedAt: data.resolvedAt
              ? (data.resolvedAt as Timestamp).toDate().toISOString()
              : undefined,
            downtimeSec: (data.metrics as { downtimeSec?: number })?.downtimeSec,
            severity: data.severity as string,
            publicMessage: data.publicMessage as string | undefined,
          }
        })

        // Compute MTTR from incidents with both startedAt+resolvedAt
        const resolvedIncs = incidentsSnap.docs.filter((d) => d.data().resolvedAt)
        const mttrSec = resolvedIncs.length > 0
          ? Math.round(
              resolvedIncs.reduce((sum, d) => {
                const data = d.data()
                const start = (data.startedAt as Timestamp).toMillis()
                const end = (data.resolvedAt as Timestamp).toMillis()
                return sum + (end - start) / 1000
              }, 0) / resolvedIncs.length,
            )
          : undefined

        // 6. Collect maintenance windows during the month
        const maintenanceSnap = await db
          .collection('maintenanceWindows')
          .where('serviceIds', 'array-contains', serviceId)
          .where('startsAt', '>=', fromTs)
          .where('startsAt', '<=', toTs)
          .orderBy('startsAt', 'asc')
          .get()

        const maintenanceSummaries = maintenanceSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: data.title as string,
            startsAt: (data.startsAt as Timestamp).toDate().toISOString(),
            endsAt: (data.endsAt as Timestamp).toDate().toISOString(),
          }
        })

        // 7. Write report
        const ref = db.collection('reports').doc()
        await ref.set({
          id: ref.id,
          serviceId,
          clientId,
          period: {
            kind: 'monthly',
            from: fromTs,
            to: toTs,
            label,
          },
          metrics: {
            uptimePct: parseFloat(uptimePct.toFixed(4)),
            downtimeSec,
            incidentCount,
            checks: totalChecks,
            ...(avgResponseMs !== undefined && { avgResponseMs }),
            ...(mttrSec !== undefined && { mttrSec }),
          },
          incidents: incidentSummaries,
          maintenance: maintenanceSummaries,
          notes: {},
          visibility: 'private',
          generatedBy: 'auto',
          generatedAt: FieldValue.serverTimestamp(),
        })

        console.log(`generateMonthlyReports: created report ${ref.id} for service ${serviceId}`)
      }
    }

    console.log(`generateMonthlyReports: complete for "${label}"`)
  },
)
