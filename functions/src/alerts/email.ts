/**
 * Email alert sender via Resend REST API.
 *
 * Resend API key is fetched from Secret Manager (secret name: resend-api-key)
 * and cached for the Cloud Function's lifetime.
 *
 * From address defaults to ALERT_FROM_EMAIL env var or a hard-coded default.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'korelab-cc'
const FROM_EMAIL = process.env.ALERT_FROM_EMAIL ?? 'alerts@alessiobernardini.dev'

const smClient = new SecretManagerServiceClient()

let _apiKey: string | null = null

async function getApiKey(): Promise<string> {
  if (_apiKey) return _apiKey

  const [version] = await smClient.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/resend-api-key/versions/latest`,
  })

  const raw = version.payload?.data
  if (!raw) throw new Error('[email] Secret resend-api-key is empty')

  _apiKey = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf-8')
  return _apiKey
}

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = await getApiKey()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from ?? FROM_EMAIL,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[email] Resend API ${res.status}: ${body}`)
  }
}
