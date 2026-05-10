/**
 * Firestore trigger: onDocumentWritten('monitors/{id}')
 *
 * Syncs the Firestore monitor document to UptimeRobot:
 * - source !== 'uptimerobot' → skip (internal-http etc. handled by Phase 10)
 * - CREATE → newMonitor; store externalId back to Firestore
 * - UPDATE → diff config; editMonitor if changed; toggle pause/resume if active changed
 * - DELETE → deleteMonitor
 * - Idempotent: if externalId exists and nothing changed → no-op
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'
import * as urClient from './client'

if (!getApps().length) initializeApp()

const db = getFirestore()

type MonitorDoc = {
  id: string
  source: string
  serviceId: string
  clientId: string
  externalId?: string
  active: boolean
  config: {
    url?: string
    intervalSec: number
    expectStatus?: number
    expectBody?: string
  }
}

export const syncUptimeRobotMonitor = onDocumentWritten(
  { document: 'monitors/{id}', timeoutSeconds: 30 },
  async (event) => {
    const before = event.data?.before?.data() as MonitorDoc | undefined
    const after = event.data?.after?.data() as MonitorDoc | undefined
    const monitorId = event.params.id

    // ── Skip non-UptimeRobot monitors ──
    const source = (after ?? before)?.source
    if (source !== 'uptimerobot') return

    // ── DELETE ──
    if (!after || !event.data?.after?.exists) {
      const externalId = before?.externalId ? Number(before.externalId) : null
      if (externalId) {
        await urClient.deleteMonitor(externalId)
      }
      return
    }

    const monitor = after

    // ── CREATE ──
    if (!before || !event.data?.before?.exists) {
      if (!monitor.config.url) {
        console.warn(`[syncMonitor] Monitor ${monitorId} has no URL — skipping UptimeRobot creation`)
        return
      }

      // Derive a friendly name from serviceId (will be improved in Phase 6 when we have service names)
      const friendlyName = `cc-${monitor.serviceId}-${monitorId.slice(0, 6)}`

      const externalId = await urClient.newMonitor({
        friendlyName,
        url: monitor.config.url,
        intervalSec: monitor.config.intervalSec,
        expectStatus: monitor.config.expectStatus,
      })

      // Store externalId back to Firestore (Admin SDK bypasses security rules)
      await db.collection('monitors').doc(monitorId).update({
        externalId: String(externalId),
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Pause immediately if created as inactive
      if (!monitor.active) {
        await urClient.editMonitor(externalId, { active: false })
      }

      return
    }

    // ── UPDATE — diff and apply minimal changes ──
    const externalId = monitor.externalId ? Number(monitor.externalId) : null

    if (!externalId) {
      // externalId not yet written (race with the create path above) — skip
      return
    }

    const changes: Parameters<typeof urClient.editMonitor>[1] = {}
    let hasChanges = false

    if (after.config.url !== before.config.url) {
      changes.url = after.config.url
      hasChanges = true
    }

    if (after.config.intervalSec !== before.config.intervalSec) {
      changes.intervalSec = after.config.intervalSec
      hasChanges = true
    }

    if (after.active !== before.active) {
      changes.active = after.active
      hasChanges = true
    }

    if (hasChanges) {
      await urClient.editMonitor(externalId, changes)
    }
  },
)
