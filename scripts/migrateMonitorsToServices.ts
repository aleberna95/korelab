/**
 * migrateMonitorsToServices.ts — One-time migration.
 *
 * For each monitor document, copies its config to the parent service
 * as service.check, then deletes the monitors collection.
 *
 * Run:
 *   npx tsx scripts/migrateMonitorsToServices.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 *     (or run via `firebase functions:shell` / emulator with --import)
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const app = initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
})

const db = getFirestore(app)

async function main() {
  const monitorsSnap = await db.collection('monitors').get()
  console.log(`Found ${monitorsSnap.size} monitors to migrate`)

  for (const monitorDoc of monitorsSnap.docs) {
    const monitor = monitorDoc.data()
    const serviceId: string = monitor.serviceId

    if (!serviceId) {
      console.warn(`  monitor ${monitorDoc.id}: no serviceId, skipping`)
      continue
    }

    const sslCheck = monitor.source === 'internal-ssl'
    const url: string = monitor.config?.url ?? monitor.healthcheckUrl ?? ''

    if (!url) {
      console.warn(`  monitor ${monitorDoc.id} (service ${serviceId}): no URL, skipping`)
      continue
    }

    const check = {
      enabled: monitor.active ?? true,
      url,
      intervalSec: monitor.config?.intervalSec ?? 300,
      timeoutMs: monitor.config?.timeoutMs ?? 10000,
      ...(monitor.config?.expectStatus ? { expectStatus: monitor.config.expectStatus } : {}),
      ...(monitor.config?.expectBody ? { expectBody: monitor.config.expectBody } : {}),
      sslCheck,
      sslAlertDays: [30, 14, 7, 1],
      alertedThresholds: monitor.alertedThresholds ?? [],
    }

    console.log(`  migrating monitor ${monitorDoc.id} → service ${serviceId} (url=${url}, ssl=${sslCheck})`)

    await db.collection('services').doc(serviceId).update({
      check,
      updatedAt: FieldValue.serverTimestamp(),
    })

    await monitorDoc.ref.delete()
    console.log(`  deleted monitor ${monitorDoc.id}`)
  }

  // Also clean up healthcheckUrl and monitorIds from services
  const servicesSnap = await db
    .collection('services')
    .where('monitorIds', '!=', null)
    .get()

  for (const svcDoc of servicesSnap.docs) {
    await svcDoc.ref.update({
      monitorIds: FieldValue.delete(),
      healthcheckUrl: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`  cleaned up service ${svcDoc.id} (removed monitorIds/healthcheckUrl)`)
  }

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
