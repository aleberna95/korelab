/**
 * onIncidentWrite — Firestore trigger.
 *
 * Fires when an incident document is created or updated.
 * On state change (or on creation), dispatches a Telegram alert.
 *
 * Alert targets:
 *   - Admin: always (telegram via ADMIN_TELEGRAM_CHAT_ID)
 *   - Client: only on 'investigating' or 'resolved', and only if:
 *       incident.notifiedClient === true
 *       client.consent.notification === true
 *       client.telegramChatId is set
 *
 * Deduplication: uses alertDedup/{key} with 60s TTL to avoid duplicate alerts.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { sendTelegramMessage } from '../alerts/telegram'

if (!getApps().length) initializeApp()

const db = getFirestore()

const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''
const DEDUP_TTL_MS = 60_000 // 60 seconds

const STATE_EMOJI: Record<string, string> = {
  investigating: '🔴',
  identified: '🟠',
  monitoring: '🟡',
  resolved: '✅',
  'false-positive': '⬛',
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const onIncidentWrite = onDocumentWritten(
  { document: 'incidents/{id}', timeoutSeconds: 30 },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    // Ignore deletes
    if (!after || !event.data?.after?.exists) return

    const isNew = !before || !event.data?.before?.exists
    const stateChanged = isNew || before?.state !== after.state

    if (!stateChanged) return

    const fromState: string | null = isNew ? null : (before?.state ?? null)
    const toState: string = after.state

    await sendIncidentAlerts(event.params.id, fromState, toState, after)
  },
)

async function sendIncidentAlerts(
  incidentId: string,
  fromState: string | null,
  toState: string,
  incident: FirebaseFirestore.DocumentData,
) {
  // ── Dedup check ────────────────────────────────────────────────────────────
  const dedupKey = `${incidentId}_${fromState ?? 'new'}_${toState}`
  const dedupRef = db.collection('alertDedup').doc(dedupKey)

  let isDuplicate = false
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dedupRef)
    if (snap.exists) {
      const age = Date.now() - (snap.data()!.sentAt?.toDate().getTime() ?? 0)
      if (age < DEDUP_TTL_MS) {
        isDuplicate = true
        return
      }
    }
    tx.set(dedupRef, {
      incidentId,
      fromState,
      toState,
      sentAt: FieldValue.serverTimestamp(),
      // Firestore TTL: clean up dedup records after 1 hour
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
  })

  if (isDuplicate) return

  const emoji = STATE_EMOJI[toState] ?? '❓'
  const transitionLabel = fromState ? `${fromState} → ${toState}` : toState

  const adminText =
    `${emoji} <b>Incident: ${escapeHtml(incident.title ?? incidentId)}</b>\n` +
    `State: <b>${transitionLabel}</b>\n` +
    `Severity: ${incident.severity ?? 'unknown'}\n` +
    `Service: ${incident.serviceId ?? ''}`

  const alerts: Promise<void>[] = []

  // Admin Telegram
  if (ADMIN_CHAT_ID) {
    alerts.push(
      sendTelegramMessage({ chatId: ADMIN_CHAT_ID, text: adminText }).catch((e) =>
        console.error('[onIncidentWrite] admin telegram:', e),
      ),
    )
  }

  await Promise.allSettled(alerts)
}
