/**
 * resolveStableUp — scheduled every 1 minute.
 *
 * Scans all incidents in 'monitoring' state. For each:
 * 1. Check if the incident has been in 'monitoring' state for ≥ 5 minutes
 *    (tracked via monitoringAt field set by the engine)
 * 2. If condition met → transition to 'resolved', compute downtimeSec,
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
      if (!monitoringAt) continue

      const monitoringAgeMs = now - monitoringAt.toDate().getTime()
      if (monitoringAgeMs < STABLE_UP_MS) continue

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
        message: `Stable for ${STABLE_UP_MIN} minutes — automatically resolved`,
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
