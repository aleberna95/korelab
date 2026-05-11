/**
 * internalChecks.ts — Scheduled Cloud Function, runs every 15 minutes.
 *
 * Fetches all active monitors with source in:
 *   ['internal-http', 'internal-ssl']
 *
 * For each monitor:
 *  1. Runs the appropriate checker.
 *  2. Writes an uptimeSample document.
 *  3. Updates monitor.lastResult + lastCheckAt.
 *  4. Opens or closes an incident via incidentHelper if result changed.
 *  5. For SSL: applies alert ladder.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import type { Monitor } from '../lib/types'
import { checkSSL } from './ssl'
import { checkHTTP } from './http'
import {
  findCrossedThreshold,
  recordThreshold,
  clearThresholds,
  SSL_THRESHOLDS,
} from './alertLadder'
import { ensureIncident, closeIncident } from './incidentHelper'
import { sendTelegramMessage } from '../alerts/telegram'

if (!getApps().length) initializeApp()

const db = getFirestore()

const INTERNAL_SOURCES = ['internal-http', 'internal-ssl']
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''

export const internalChecks = onSchedule(
  { schedule: 'every 15 minutes', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    // Firestore 'in' supports up to 10 values
    let monitorsSnap: FirebaseFirestore.QuerySnapshot
    try {
      monitorsSnap = await db
        .collection('monitors')
        .where('active', '==', true)
        .where('source', 'in', INTERNAL_SOURCES)
        .get()
    } catch (err) {
      console.error('internalChecks: Firestore query failed:', err)
      throw err
    }

    console.log(`internalChecks: ${monitorsSnap.size} active monitors found`)
    monitorsSnap.docs.forEach((d) => {
      const data = d.data()
      console.log(`  monitor ${d.id}: source=${data.source} url=${data.config?.url} active=${data.active}`)
    })

    // Process monitors concurrently but cap parallelism to avoid thundering herd
    const CONCURRENCY = 10
    const docs = monitorsSnap.docs
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
      await Promise.allSettled(
        docs.slice(i, i + CONCURRENCY).map((doc) =>
          processMonitor({ ...doc.data(), id: doc.id } as Monitor).catch((err) =>
            console.error(`internalChecks: error for monitor ${doc.id}:`, err),
          ),
        ),
      )
    }

    console.log('internalChecks: complete')
  },
)

async function processMonitor(monitor: Monitor): Promise<void> {
  const { id: monitorId, serviceId, clientId, source } = monitor

  // ── 1. Run the right checker ─────────────────────────────────────────────
  type GenericResult = { result: 'up' | 'down' | 'degraded'; responseMs: number; error?: string; daysToExpiry?: number }

  let checkResult: GenericResult

  switch (source) {
    case 'internal-ssl':
      checkResult = await checkSSL(monitor)
      break
    case 'internal-http':
      checkResult = await checkHTTP(monitor)
      break
    default:
      return
  }

  const { result, responseMs, error, daysToExpiry } = checkResult
  const now = Timestamp.now()
  // Firestore TTL: uptimeSamples expire after 30 days
  const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // ── 2. Write uptimeSample ─────────────────────────────────────────────────
  await db.collection('uptimeSamples').add({
    monitorId,
    serviceId,
    clientId,
    result,
    responseMs,
    recordedAt: now,
    expiresAt,
    source,
    ...(error && { error }),
    ...(daysToExpiry !== undefined && { daysToExpiry }),
  })

  // ── 3. Update monitor ─────────────────────────────────────────────────────
  await db.collection('monitors').doc(monitorId).update({
    lastResult: result,
    lastCheckAt: now,
  })

  const previousResult = monitor.lastResult

  // ── 4. Incident management ────────────────────────────────────────────────
  if (result === 'down') {
    await ensureIncident({
      monitorId,
      serviceId,
      clientId,
      title: buildTitle(source, monitor, error),
      severity: 'major',
      source: 'internal-check',
    })
  } else if (result === 'degraded') {
    // degraded → open minor incident
    await ensureIncident({
      monitorId,
      serviceId,
      clientId,
      title: buildTitle(source, monitor, error, daysToExpiry),
      severity: 'minor',
      source: 'internal-check',
    })
  } else if (result === 'up' && (previousResult === 'down' || previousResult === 'degraded')) {
    // Recovery from failure
    await closeIncident(serviceId)
    await clearThresholds(db, monitorId)
  } else if (result === 'up') {
    // Healthy check — ensure service status is operational (handles first-run and unknown state)
    const svcSnap = await db.collection('services').doc(serviceId).get()
    const currentState = (svcSnap.data() as { currentStatus?: { state?: string } } | undefined)
      ?.currentStatus?.state
    if (currentState !== 'operational') {
      await db.collection('services').doc(serviceId).update({
        'currentStatus.state': 'operational',
        'currentStatus.since': now,
        'currentStatus.activeIncidentId': null,
      })
    }
  }

  // ── 5. Alert ladder for SSL ────────────────────────────────────────────
  if (daysToExpiry !== undefined && source === 'internal-ssl') {
    const alreadyAlerted = monitor.alertedThresholds ?? []
    const threshold = findCrossedThreshold(daysToExpiry, SSL_THRESHOLDS, alreadyAlerted)

    if (threshold !== null) {
      await recordThreshold(db, monitorId, threshold)

      if (ADMIN_CHAT_ID) {
        const label = 'SSL certificate'
        const url = monitor.config.url ?? monitorId
        await sendTelegramMessage({
          chatId: ADMIN_CHAT_ID,
          text: `⚠️ <b>${label} expiry warning</b>\n<b>${url}</b> expires in <b>${daysToExpiry} days</b> (threshold: ${threshold}d)`,
        }).catch((err) => console.error('Telegram alert failed:', err))
      }
    }
  }

  // ── 6. Notify on first failure ────────────────────────────────────────────
  if (result !== 'up' && previousResult === 'up' && ADMIN_CHAT_ID) {
    const label = source.replace('internal-', '').toUpperCase()
    const url = monitor.config.url ?? monitorId
    await sendTelegramMessage({
      chatId: ADMIN_CHAT_ID,
      text: `🔴 <b>${label} check failed</b>\n${url}\n${error ?? result}`,
    }).catch((err) => console.error('Telegram alert failed:', err))
  }
}

function buildTitle(
  source: string,
  monitor: Monitor,
  error?: string,
  daysToExpiry?: number,
): string {
  const url = monitor.config.url ?? 'unknown'
  const label = source.replace('internal-', '').toUpperCase()

  if (daysToExpiry !== undefined) {
    return `${label} expiring in ${daysToExpiry} days — ${url}`
  }
  if (error) {
    return `${label} check failed — ${url}`
  }
  return `${label} check degraded — ${url}`
}
