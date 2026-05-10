/**
 * onIncidentWrite — Firestore trigger.
 *
 * Fires when an incident document is created or updated.
 * On state change (or on creation), dispatches alerts via Telegram and email.
 *
 * Alert targets:
 *   - Admin: always (telegram + email using env vars)
 *   - Client: only on 'investigating' or 'resolved', and only if:
 *       incident.notifiedClient === true
 *       client.consent.notification === true
 *
 * Deduplication: uses alertDedup/{key} with 60s TTL to avoid duplicate alerts
 * when the document is written multiple times in quick succession.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { sendTelegramMessage } from '../alerts/telegram'
import { sendEmail } from '../alerts/email'

if (!getApps().length) initializeApp()

const db = getFirestore()

const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''
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

  const adminHtml =
    `<p>${emoji} <strong>Incident: ${escapeHtml(incident.title ?? incidentId)}</strong></p>` +
    `<p>State: <strong>${escapeHtml(transitionLabel)}</strong><br>` +
    `Severity: ${escapeHtml(incident.severity ?? 'unknown')}<br>` +
    `Service: ${escapeHtml(incident.serviceId ?? '')}</p>`

  const alerts: Promise<void>[] = []

  // Admin Telegram
  if (ADMIN_CHAT_ID) {
    alerts.push(
      sendTelegramMessage({ chatId: ADMIN_CHAT_ID, text: adminText }).catch((e) =>
        console.error('[onIncidentWrite] admin telegram:', e),
      ),
    )
  }

  // Admin email
  if (ADMIN_EMAIL) {
    alerts.push(
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `${emoji} ${incident.title ?? incidentId} — ${toState}`,
        html: adminHtml,
      }).catch((e) => console.error('[onIncidentWrite] admin email:', e)),
    )
  }

  // Client alerts: only on investigating (first alert) or resolved
  const alertClient = toState === 'investigating' || toState === 'resolved'
  if (alertClient && incident.notifiedClient && incident.clientId) {
    const clientSnap = await db.collection('clients').doc(incident.clientId).get()
    const client = clientSnap.data()

    if (client?.consent?.notification) {
      const publicMsg = incident.publicMessage
        ? `\n${escapeHtml(incident.publicMessage)}`
        : ''
      const clientText =
        `${emoji} <b>${escapeHtml(incident.title ?? '')}</b>${publicMsg}`
      const clientHtml =
        `<p>${emoji} <strong>${escapeHtml(incident.title ?? '')}</strong>${publicMsg.replace(/\n/g, '<br>')}</p>`

      if (client.notificationPrefs?.telegramChatId) {
        alerts.push(
          sendTelegramMessage({
            chatId: client.notificationPrefs.telegramChatId,
            text: clientText,
          }).catch((e) => console.error('[onIncidentWrite] client telegram:', e)),
        )
      }

      const emails: string[] = client.notificationPrefs?.emails ?? []
      if (emails.length > 0) {
        alerts.push(
          sendEmail({
            to: emails,
            subject: `${emoji} ${incident.title ?? ''} — ${toState}`,
            html: clientHtml,
          }).catch((e) => console.error('[onIncidentWrite] client email:', e)),
        )
      }
    }
  }

  await Promise.allSettled(alerts)
}
