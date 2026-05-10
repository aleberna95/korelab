/**
 * incidentHelper.ts — lightweight incident create/close for Cloud Functions.
 *
 * Mirrors the logic of src/lib/incidents/engine.ts but uses raw Firestore
 * (no @/ imports, since functions is a separate TS project).
 *
 * Only handles the simple cases needed by internal checks:
 *  - ensureIncident: open a new incident if none is active
 *  - resolveIncident: close the active incident for a service
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const db = getFirestore()

export type IncidentSeverity = 'minor' | 'major' | 'critical'

export interface EnsureIncidentOptions {
  monitorId: string
  serviceId: string
  clientId: string
  title: string
  severity: IncidentSeverity
  source: string
  publicMessage?: string
}

/**
 * Opens a new 'investigating' incident for the service if no active incident
 * already exists. Also sets service.currentStatus.state accordingly.
 * Returns the incident id (new or existing).
 */
export async function ensureIncident(opts: EnsureIncidentOptions): Promise<string> {
  const { monitorId, serviceId, clientId, title, severity, source, publicMessage } = opts

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
    publicMessage: publicMessage ?? '',
    visibility: 'public',
    notifiedClient: false,
    metrics: {},
    monitorId,
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
 * Transitions the active incident for a service to 'monitoring' or resolves it.
 * Called when a check comes back 'up'.
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
    'currentStatus.uptime30d': null, // will be recalculated by dailyRollup
  })

  // Record downtime in metrics
  batch.update(incDoc.ref, {
    'metrics.downtimeSec': downtimeSec,
  })

  await batch.commit()
}
