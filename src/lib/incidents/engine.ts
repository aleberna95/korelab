/**
 * Incident engine — Phase 5.
 *
 * Processes a normalized monitor event and applies the incident state machine:
 *  - down + no active incident → create incident (investigating)
 *  - down + active incident    → append timeline event; if monitoring → re-open
 *  - up   + active incident    → set state to monitoring, record monitoringAt
 *  - paused                    → no-op
 *
 * Debounce: if the previous event was the opposite kind within 60 s, drop.
 * Maintenance suppression: if a maintenanceWindow covers this service+time, skip creation.
 */

import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { deriveSeverity, severityToStatusState } from './severity'
import type { NormalizedEvent } from '@/lib/webhooks/uptimerobot/normalize'
import type { IncidentState } from './transitions'

export type EngineContext = {
  monitorId: string
  serviceId: string
  event: NormalizedEvent
  /** lastResult before this event (for debounce) */
  previousResult?: string | null
  /** lastCheckAt before this event (for debounce) */
  previousCheckAt?: Date | null
}

const DEBOUNCE_MS = 60_000 // 1 minute

export async function dispatchToIncidentEngine(ctx: EngineContext): Promise<void> {
  const { monitorId, serviceId, event, previousResult, previousCheckAt } = ctx

  // paused events don't drive incident state
  if (event.kind === 'paused') return

  const db = getAdminDb()

  // ── 1. Debounce — drop flapping events ────────────────────────────────────
  if (event.kind === 'down' && previousResult === 'up' && previousCheckAt) {
    const elapsedMs = event.at.getTime() - previousCheckAt.getTime()
    if (elapsedMs < DEBOUNCE_MS) return // flap within 60 s — drop
  }

  // ── 2. Maintenance window suppression (for new incidents only) ────────────
  if (event.kind === 'down') {
    const mwSnap = await db
      .collection('maintenanceWindows')
      .where('serviceIds', 'array-contains', serviceId)
      .where('endsAt', '>=', event.at)
      .get()

    const suppressed = mwSnap.docs.some((d) => {
      const mw = d.data()
      return mw.suppressIncidents && mw.startsAt.toDate() <= event.at
    })

    if (suppressed) return
  }

  // ── 3. Find active incident for this service ──────────────────────────────
  const activeSnap = await db
    .collection('incidents')
    .where('serviceId', '==', serviceId)
    .where('state', 'in', ['investigating', 'identified', 'monitoring'])
    .orderBy('startedAt', 'desc')
    .limit(1)
    .get()

  const activeDoc = activeSnap.empty ? null : activeSnap.docs[0]

  // ── 4. Apply state machine rules ──────────────────────────────────────────

  if (event.kind === 'down') {
    if (!activeDoc) {
      // ── CREATE new incident ──
      const serviceSnap = await db.collection('services').doc(serviceId).get()
      const service = serviceSnap.data() as
        | { clientId: string; criticality: string; name: string }
        | undefined

      const severity = deriveSeverity(service?.criticality)
      const statusState = severityToStatusState(severity)
      const title = `${service?.name ?? serviceId} is down`

      const incidentRef = db.collection('incidents').doc()
      const timelineRef = db
        .collection('incidents')
        .doc(incidentRef.id)
        .collection('timeline')
        .doc()

      const batch = db.batch()

      batch.set(incidentRef, {
        id: incidentRef.id,
        serviceId,
        clientId: service?.clientId ?? '',
        state: 'investigating' as IncidentState,
        severity,
        startedAt: FieldValue.serverTimestamp(),
        source: 'uptimerobot',
        title,
        publicMessage: '',
        privateMessage: '',
        visibility: 'private',
        notifiedClient: false,
        metrics: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      batch.set(timelineRef, {
        id: timelineRef.id,
        at: FieldValue.serverTimestamp(),
        kind: 'detected',
        message: `Down detected by monitor ${monitorId}`,
      })

      batch.update(db.collection('services').doc(serviceId), {
        'currentStatus.state': statusState,
        'currentStatus.since': FieldValue.serverTimestamp(),
        'currentStatus.activeIncidentId': incidentRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      })

      await batch.commit()
    } else {
      // ── EXISTING incident — append timeline ──
      const currentState = activeDoc.data().state as IncidentState
      const timelineRef = db
        .collection('incidents')
        .doc(activeDoc.id)
        .collection('timeline')
        .doc()

      const batch = db.batch()

      batch.set(timelineRef, {
        id: timelineRef.id,
        at: FieldValue.serverTimestamp(),
        kind: 'updated',
        message: `Monitor ${monitorId} continues to report down`,
      })

      // If it flapped back from monitoring → re-open to investigating
      if (currentState === 'monitoring') {
        batch.update(db.collection('incidents').doc(activeDoc.id), {
          state: 'investigating' as IncidentState,
          monitoringAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        batch.update(db.collection('services').doc(serviceId), {
          'currentStatus.state': activeDoc.data().severity === 'critical' ? 'major-outage' : 'partial-outage',
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      await batch.commit()
    }
  } else if (event.kind === 'up' && activeDoc) {
    const currentState = activeDoc.data().state as IncidentState

    if (currentState === 'investigating' || currentState === 'identified') {
      const timelineRef = db
        .collection('incidents')
        .doc(activeDoc.id)
        .collection('timeline')
        .doc()

      const batch = db.batch()

      batch.update(db.collection('incidents').doc(activeDoc.id), {
        state: 'monitoring' as IncidentState,
        monitoringAt: FieldValue.serverTimestamp(), // used by resolveStableUp
        updatedAt: FieldValue.serverTimestamp(),
      })

      batch.set(timelineRef, {
        id: timelineRef.id,
        at: FieldValue.serverTimestamp(),
        kind: 'updated',
        message: `Monitor ${monitorId} back up — monitoring stability for 5 minutes`,
      })

      batch.update(db.collection('services').doc(serviceId), {
        'currentStatus.state': 'degraded',
        updatedAt: FieldValue.serverTimestamp(),
      })

      await batch.commit()
    }
  }
}
