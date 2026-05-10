/**
 * resolveStableUp — scheduled every 1 minute.
 *
 * Scans all incidents in 'monitoring' state. For each:
 * 1. Check if ALL active monitors for the service report lastResult='up'
 * 2. Check if the incident has been in 'monitoring' state for ≥ 5 minutes
 *    (tracked via monitoringAt field set by the engine)
 * 3. If both conditions met → transition to 'resolved', compute downtimeSec,
 *    update service.currentStatus.state = 'operational'
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'

if (!getApps().length) initializeApp()

const db = getFirestore()

const STABLE_UP_MIN = 5
const STABLE_UP_MS = STABLE_UP_MIN * 60_000

export const resolveStableUp = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 55, maxInstances: 1 },
  async () => {
    const now = Date.now()

    const monitoringSnap = await db
      .collection('incidents')
      .where('state', '==', 'monitoring')
      .limit(50)
      .get()

    if (monitoringSnap.empty) return

    for (const incidentDoc of monitoringSnap.docs) {
      const incident = incidentDoc.data()

      // ── Check stability window ────────────────────────────────────────────
      const monitoringAt: FirebaseFirestore.Timestamp | undefined = incident.monitoringAt
      if (!monitoringAt) continue // no monitoringAt set yet — skip

      const monitoringAgeMs = now - monitoringAt.toDate().getTime()
      if (monitoringAgeMs < STABLE_UP_MS) continue // not yet 5 minutes stable

      // ── Check all active monitors for this service ────────────────────────
      const monitorsSnap = await db
        .collection('monitors')
        .where('serviceId', '==', incident.serviceId)
        .where('active', '==', true)
        .get()

      if (monitorsSnap.empty) continue

      const allUp = monitorsSnap.docs.every((d) => {
        const m = d.data()
        return m.lastResult === 'up'
      })

      if (!allUp) continue

      // ── Resolve the incident ──────────────────────────────────────────────
      const startedAt: FirebaseFirestore.Timestamp | undefined = incident.startedAt
      const downtimeSec = startedAt
        ? Math.round((now - startedAt.toDate().getTime()) / 1000)
        : null

      const batch = db.batch()

      batch.update(db.collection('incidents').doc(incidentDoc.id), {
        state: 'resolved',
        resolvedAt: FieldValue.serverTimestamp(),
        'metrics.downtimeSec': downtimeSec,
        updatedAt: FieldValue.serverTimestamp(),
      })

      const timelineRef = db
        .collection('incidents')
        .doc(incidentDoc.id)
        .collection('timeline')
        .doc()

      batch.set(timelineRef, {
        id: timelineRef.id,
        at: FieldValue.serverTimestamp(),
        kind: 'resolved',
        message: `All monitors stable for ${STABLE_UP_MIN} minutes — automatically resolved`,
      })

      batch.update(db.collection('services').doc(incident.serviceId), {
        'currentStatus.state': 'operational',
        'currentStatus.since': FieldValue.serverTimestamp(),
        'currentStatus.activeIncidentId': FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      await batch.commit()
    }
  },
)
