/**
 * weeklyHealthCheck.ts — Scheduled Cloud Function (every Monday 08:00 UTC).
 *
 * Pings each external integration and posts a status summary to the admin
 * Telegram channel. Catches individual probe errors so one failure doesn't
 * block the rest of the report.
 *
 * Integrations probed:
 *  - UptimeRobot API  (GET /getAccountDetails with API key from Secret Manager)
 *  - Telegram Bot API (getMe with bot token from Secret Manager)
 *  - Resend API       (GET /domains with API key from Secret Manager)
 *  - Firestore        (a trivial document read to verify Admin SDK connectivity)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { sendTelegramMessage } from './alerts/telegram'

if (!getApps().length) initializeApp()

const db = getFirestore()
const smClient = new SecretManagerServiceClient()
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'korelab-cc'
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''

type ProbeResult = { name: string; ok: boolean; detail: string }

// ── Secret helpers (no caching — function runs once/week) ─────────────────

async function getSecret(secretName: string): Promise<string> {
  const [version] = await smClient.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  })
  const raw = version.payload?.data
  if (!raw) throw new Error(`Secret ${secretName} is empty`)
  return typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf-8')
}

// ── Individual probes ─────────────────────────────────────────────────────

async function probeUptimeRobot(): Promise<ProbeResult> {
  const name = 'UptimeRobot'
  try {
    const apiKey = await getSecret('uptimerobot-api-key')
    const res = await fetch('https://api.uptimerobot.com/v2/getAccountDetails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, format: 'json' }),
      signal: AbortSignal.timeout(8_000),
    })
    const data = (await res.json()) as { stat?: string; account?: { email?: string } }
    if (data.stat === 'ok' && data.account?.email) {
      return { name, ok: true, detail: `account: ${data.account.email}` }
    }
    return { name, ok: false, detail: `stat=${data.stat ?? 'unknown'}` }
  } catch (err) {
    return { name, ok: false, detail: String(err) }
  }
}

async function probeTelegram(): Promise<ProbeResult> {
  const name = 'Telegram'
  try {
    const token = await getSecret('telegram-bot-token')
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8_000),
    })
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } }
    if (data.ok && data.result?.username) {
      return { name, ok: true, detail: `@${data.result.username}` }
    }
    return { name, ok: false, detail: JSON.stringify(data) }
  } catch (err) {
    return { name, ok: false, detail: String(err) }
  }
}

async function probeResend(): Promise<ProbeResult> {
  const name = 'Resend'
  try {
    const apiKey = await getSecret('resend-api-key')
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { data?: unknown[] }
      return { name, ok: true, detail: `${data.data?.length ?? 0} domain(s)` }
    }
    return { name, ok: false, detail: `HTTP ${res.status}` }
  } catch (err) {
    return { name, ok: false, detail: String(err) }
  }
}

async function probeFirestore(): Promise<ProbeResult> {
  const name = 'Firestore'
  try {
    await db.collection('_healthCheck').doc('ping').set({ at: FieldValue.serverTimestamp() })
    return { name, ok: true, detail: 'write succeeded' }
  } catch (err) {
    return { name, ok: false, detail: String(err) }
  }
}

// ── Function ──────────────────────────────────────────────────────────────

export const weeklyHealthCheck = onSchedule(
  { schedule: 'every monday 08:00', timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    const results = await Promise.allSettled([
      probeUptimeRobot(),
      probeTelegram(),
      probeResend(),
      probeFirestore(),
    ])

    const probes: ProbeResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      const names = ['UptimeRobot', 'Telegram', 'Resend', 'Firestore']
      return { name: names[i], ok: false, detail: String(r.reason) }
    })

    const allOk = probes.every((p) => p.ok)
    const lines = probes.map((p) => `${p.ok ? '✅' : '❌'} <b>${p.name}</b> — ${p.detail}`)
    const header = allOk
      ? '✅ <b>Weekly integration check — all systems OK</b>'
      : '⚠️ <b>Weekly integration check — one or more integrations failed</b>'

    const text = [header, '', ...lines].join('\n')
    console.log('weeklyHealthCheck:', JSON.stringify(probes))

    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage({ chatId: ADMIN_CHAT_ID, text })
    }
  },
)
