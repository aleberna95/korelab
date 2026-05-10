'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { maintenanceRepo } from '@/lib/repos/maintenanceRepo'
import { getAdminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { revalidatePath } from 'next/cache'
import type { DailyRollup } from '@/lib/domain/types'

interface GenerateInput {
  serviceId: string
  clientId: string
  from: string   // ISO datetime
  to: string     // ISO datetime
  label: string
  clientNotes?: string
  privateNotes?: string
  visibility: 'private' | 'tokenized' | 'email'
}

export async function generateReport(input: GenerateInput): Promise<string> {
  const { uid } = await requireAdmin()

  const { serviceId, clientId, from, to, label, clientNotes, privateNotes, visibility } = input

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const fromTs = Timestamp.fromDate(fromDate)
  const toTs = Timestamp.fromDate(toDate)

  const fromDay = from.slice(0, 10)
  const toDay = to.slice(0, 10)

  // 1. Verify service exists
  const service = await servicesRepo.getById(serviceId)
  if (!service) throw new Error('Service not found')

  // 2. Aggregate daily rollups
  const rollupSnap = await getAdminDb()
    .collection('services')
    .doc(serviceId)
    .collection('daily')
    .where('date', '>=', fromDay)
    .where('date', '<=', toDay)
    .orderBy('date', 'asc')
    .get()

  const rollups = rollupSnap.docs.map((d) => d.data() as DailyRollup)

  const totalChecks = rollups.reduce((s, r) => s + r.checks, 0)
  const totalDown = rollups.reduce((s, r) => s + r.downChecks, 0)
  const uptimePct = totalChecks > 0
    ? Math.min(100, ((totalChecks - totalDown) / totalChecks) * 100)
    : 100
  const downtimeSec = rollups.reduce((s, r) => s + r.downtimeSec, 0)
  const incidentCountRollup = rollups.reduce((s, r) => s + r.incidentCount, 0)

  const upWithMs = rollups.filter((r) => r.avgResponseMs != null)
  const avgResponseMs = upWithMs.length > 0
    ? Math.round(upWithMs.reduce((s, r) => s + (r.avgResponseMs ?? 0), 0) / upWithMs.length)
    : undefined

  // 3. Fetch incidents in range
  const incidents = await incidentsRepo.listByService(serviceId, 100)
  const periodIncidents = incidents.filter((inc) => {
    const startMs = (inc.startedAt as unknown as { toMillis(): number }).toMillis()
    return startMs >= fromDate.getTime() && startMs <= toDate.getTime()
  })

  const resolvedIncs = periodIncidents.filter((i) => i.resolvedAt)
  const mttrSec = resolvedIncs.length > 0
    ? Math.round(
        resolvedIncs.reduce((sum, i) => {
          const start = (i.startedAt as unknown as { toMillis(): number }).toMillis()
          const end = (i.resolvedAt as unknown as { toMillis(): number }).toMillis()
          return sum + (end - start) / 1000
        }, 0) / resolvedIncs.length,
      )
    : undefined

  const incidentSummaries = periodIncidents.map((inc) => ({
    id: inc.id,
    title: inc.title,
    startedAt: (inc.startedAt as unknown as { toDate(): Date }).toDate().toISOString(),
    resolvedAt: inc.resolvedAt
      ? (inc.resolvedAt as unknown as { toDate(): Date }).toDate().toISOString()
      : undefined,
    downtimeSec: inc.metrics.downtimeSec,
    severity: inc.severity,
    publicMessage: inc.publicMessage,
  }))

  // 4. Fetch maintenance in range
  const allMaintenance = await maintenanceRepo.list({ serviceId, limit: 50 })
  const periodMaintenance = allMaintenance.filter((mw) => {
    const startMs = (mw.startsAt as unknown as { toMillis(): number }).toMillis()
    return startMs >= fromDate.getTime() && startMs <= toDate.getTime()
  })

  const maintenanceSummaries = periodMaintenance.map((mw) => ({
    id: mw.id,
    title: mw.title,
    startsAt: (mw.startsAt as unknown as { toDate(): Date }).toDate().toISOString(),
    endsAt: (mw.endsAt as unknown as { toDate(): Date }).toDate().toISOString(),
  }))

  // 5. Create report
  const report = await reportsRepo.create(
    {
      serviceId,
      clientId,
      period: {
        kind: 'custom',
        from: fromTs.toDate().toISOString(),
        to: toTs.toDate().toISOString(),
        label,
      },
      metrics: {
        uptimePct: parseFloat(uptimePct.toFixed(4)),
        downtimeSec,
        incidentCount: incidentCountRollup || periodIncidents.length,
        checks: totalChecks,
        ...(avgResponseMs !== undefined && { avgResponseMs }),
        ...(mttrSec !== undefined && { mttrSec }),
      },
      incidents: incidentSummaries,
      maintenance: maintenanceSummaries,
      notes: {
        client: clientNotes || undefined,
        private: privateNotes || undefined,
      },
      visibility,
      generatedBy: 'manual',
      generatedByUid: uid,
    },
    uid,
  )

  revalidatePath('/admin/reports')
  return report.id
}
