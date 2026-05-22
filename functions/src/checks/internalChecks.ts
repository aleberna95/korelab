/**
 * internalChecks.ts — Scheduled Cloud Function, runs every 15 minutes.
 *
 * Negative-model: only writes to Firestore on UP↔DOWN transitions.
 * No uptimeSamples, no lastCheckAt updates.
 *
 * HTTP transitions:
 *  - not major-outage → down/degraded: open incident + Telegram alert
 *  - major-outage → up: resolve incident + Telegram recovery
 *  - steady state (up→up or down→down): zero writes
 *
 * SSL: alertLadder still fires for certificate expiry warnings (unchanged).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import type { Service, ServiceCheck, ServiceStatusState } from '../lib/types'
import { checkSSL } from './ssl'
import { checkHTTP } from './http'
import {
  findCrossedThreshold,
  recordThreshold,
  clearThresholds,
  SSL_THRESHOLDS,
} from './alertLadder'
import { ensureIncident, resolveIncident } from './incidentHelper'
import { sendTelegramMessage } from '../alerts/telegram'
import { determineHttpAction } from './transitions'

if (!getApps().length) initializeApp()

const db = getFirestore()

const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''

// ─── Cloud Function ────────────────────────────────────────────────────────

export const internalChecks = onSchedule(
  { schedule: 'every 15 minutes', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    let servicesSnap: FirebaseFirestore.QuerySnapshot
    try {
      servicesSnap = await db
        .collection('services')
        .where('check.enabled', '==', true)
        .get()
    } catch (err) {
      console.error('internalChecks: Firestore query failed:', err)
      throw err
    }

    console.log(`internalChecks: ${servicesSnap.size} services with checks enabled`)

    const CONCURRENCY = 10
    const docs = servicesSnap.docs
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
      await Promise.allSettled(
        docs.slice(i, i + CONCURRENCY).map((doc) =>
          processService({ ...doc.data(), id: doc.id } as Service).catch((err) =>
            console.error(`internalChecks: error for service ${doc.id}:`, err),
          ),
        ),
      )
    }

    console.log('internalChecks: complete')
  },
)

async function processService(service: Service): Promise<void> {
  const { id: serviceId, clientId, check } = service
  if (!check) return

  const currentState: ServiceStatusState = service.currentStatus?.state ?? 'unknown'

  // ── HTTP check ────────────────────────────────────────────────────────────
  const { result, error } = await checkHTTP(check)
  const action = determineHttpAction(result, currentState, check, error)

  if (action.type === 'open_incident') {
    await ensureIncident({
      serviceId,
      clientId,
      title: action.title,
      severity: 'major',
      source: 'internal-check',
    })
    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage({
        chatId: ADMIN_CHAT_ID,
        text: `🔴 <b>HTTP check failed</b>\n${check.url}\n${error ?? result}`,
      }).catch((err) => console.error('Telegram alert failed:', err))
    }
  } else if (action.type === 'close_incident') {
    await resolveIncident(serviceId)
    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage({
        chatId: ADMIN_CHAT_ID,
        text: `✅ <b>Recovery</b>\n${check.url} is back online`,
      }).catch((err) => console.error('Telegram recovery alert failed:', err))
    }
  } else if (result === 'up' && currentState !== 'operational') {
    // Service is UP but state is unknown/degraded/etc. — set operational directly.
    // This happens for new services that have never had an incident.
    await db.collection('services').doc(serviceId).update({
      'currentStatus.state': 'operational',
      'currentStatus.since': FieldValue.serverTimestamp(),
    })
    console.log(`internalChecks: ${serviceId} → operational (first confirmed up)`)
  }

  // ── SSL check ─────────────────────────────────────────────────────────────
  if (check.sslCheck) {
    await processSSLCheck(service, check)
  }
}

async function processSSLCheck(service: Service, check: ServiceCheck): Promise<void> {
  const { id: serviceId, clientId } = service

  const { result: sslStatus, daysToExpiry, error } = await checkSSL(check)

  // SSL alert ladder — fires on cert expiry warnings
  if (daysToExpiry !== undefined) {
    const alreadyAlerted = check.alertedThresholds ?? []
    const alertDays = check.sslAlertDays?.length ? check.sslAlertDays : SSL_THRESHOLDS
    const threshold = findCrossedThreshold(daysToExpiry, alertDays, alreadyAlerted)

    if (threshold !== null) {
      await recordThreshold(db, serviceId, threshold)

      if (ADMIN_CHAT_ID) {
        await sendTelegramMessage({
          chatId: ADMIN_CHAT_ID,
          text: `⚠️ <b>SSL certificate expiry warning</b>\n<b>${check.url}</b> expires in <b>${daysToExpiry} days</b> (threshold: ${threshold}d)`,
        }).catch((err) => console.error('Telegram alert failed:', err))
      }
    }
  }

  if (sslStatus === 'down' || sslStatus === 'degraded') {
    await ensureIncident({
      serviceId,
      clientId,
      title: buildSSLTitle(check, daysToExpiry, error),
      severity: sslStatus === 'down' ? 'major' : 'minor',
      source: 'internal-check',
    })
  } else if (sslStatus === 'up') {
    if ((check.alertedThresholds ?? []).length > 0) {
      await clearThresholds(db, serviceId)
    }
  }
}

function buildSSLTitle(check: ServiceCheck, daysToExpiry?: number, error?: string): string {
  if (daysToExpiry !== undefined) return `SSL expiring in ${daysToExpiry} days — ${check.url}`
  if (error) return `SSL check failed — ${check.url}`
  return `SSL check degraded — ${check.url}`
}
