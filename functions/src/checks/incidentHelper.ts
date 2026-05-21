/**
 * incidentHelper.ts — lightweight incident create/resolve for Cloud Functions.
 *
 * Mirrors the logic of src/lib/incidents/engine.ts but uses raw Firestore
 * (no @/ imports, since functions is a separate TS project).
 *
 * Only handles the simple cases needed by internal checks:
 *  - ensureIncident: open a new incident if none is active
 *  - resolveIncident: resolve the active incident directly to 'resolved'
 *  - closeIncident: legacy — transitions to 'monitoring' (kept for reference)
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'

if (!getApps().length) initializeApp()

const db = getFirestore()

export type IncidentSeverity = 'minor' | 'major' | 'critical'

export interface EnsureIncidentOptions {
  serviceId: string
  clientId: string
  title: string
  severity: IncidentSeverity
  source: string
}

/**
 * Opens a new 'investigating' incident for the service if no active incident
 * already exists. Also sets service.currentStatus.state accordingly.
 * Returns the incident id (new or existing).
 */
export async function ensureIncident(opts: EnsureIncidentOptions): Promise<string> {
  const { serviceId, clientId, title, severity, source } = opts

  // Check for existing active incident
  const activeSnap = await db
    .collection('incidents')
    .where('serviceId', '==', serviceId)
    .where('state', 'in', ['investigating', 'identified', 'monitoring'])
    .limit(1)
    .get()

  if (!activeSnap.empty) {
    return activeSnap.docs[0].id
  }

  const now = FieldValue.serverTimestamp()
  const ref = db.collection('incidents').doc()

  const serviceState = severity === 'minor' ? 'degraded' : 'major-outage'

  await ref.set({
    id: ref.id,
    serviceId,
    clientId,
    state: 'investigating',
    severity,
    startedAt: now,
    source,
    title,
    metrics: {},
  })

  // Update service status
  await db.collection('services').doc(serviceId).update({
    'currentStatus.state': serviceState,
    'currentStatus.since': now,
    'currentStatus.activeIncidentId': ref.id,
  })

  return ref.id
}

/**
 * Resolves the active incident for a service directly to 'resolved'.
 * Called by automated check recovery (DOWN→UP transition).
 * Always resets service.currentStatus to operational, even if no incident found.
 */
export async function resolveIncident(serviceId: string): Promise<void> {
  const activeSnap = await db
    .collection('incidents')
    .where('serviceId', '==', serviceId)
    .where('state', 'in', ['investigating', 'identified', 'monitoring'])
    .limit(1)
    .get()

  const batch = db.batch()

  if (!activeSnap.empty) {
    const incDoc = activeSnap.docs[0]
    const startedAt: Timestamp = incDoc.data().startedAt
    const now = Timestamp.now()
    const downtimeSec = Math.round((now.toMillis() - startedAt.toMillis()) / 1000)

    batch.update(incDoc.ref, {
      state: 'resolved',
      resolvedAt: FieldValue.serverTimestamp(),
      'metrics.downtimeSec': downtimeSec,
    })
  }

  batch.update(db.collection('services').doc(serviceId), {
    'currentStatus.state': 'operational',
    'currentStatus.since': FieldValue.serverTimestamp(),
    'currentStatus.activeIncidentId': null,
  })

  await batch.commit()
}

/**
 * @deprecated Use resolveIncident instead.
 * Transitions the active incident to 'monitoring' (not fully resolved).
 */
export async function closeIncident(serviceId: string): Promise<void> {
  const activeSnap = await db
    .collection('incidents')
    .where('serviceId', '==', serviceId)
    .where('state', 'in', ['investigating', 'identified'])
    .limit(1)
    .get()

  if (activeSnap.empty) return

  const incDoc = activeSnap.docs[0]
  const startedAt: Timestamp = incDoc.data().startedAt
  const now = Timestamp.now()
  const downtimeSec = Math.round((now.toMillis() - startedAt.toMillis()) / 1000)

  const batch = db.batch()

  batch.update(incDoc.ref, {
    state: 'monitoring',
    monitoringAt: FieldValue.serverTimestamp(),
  })

  batch.update(db.collection('services').doc(serviceId), {
    'currentStatus.state': 'operational',
    'currentStatus.since': FieldValue.serverTimestamp(),
    'currentStatus.activeIncidentId': null,
  })

  batch.update(incDoc.ref, {
    'metrics.downtimeSec': downtimeSec,
  })

  await batch.commit()
}
