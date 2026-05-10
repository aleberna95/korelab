/**
 * Telegram Bot alert sender.
 *
 * Bot token is fetched from Secret Manager (secret name: telegram-bot-token)
 * and cached for the Cloud Function's lifetime.
 *
 * Admin chat ID is read from ADMIN_TELEGRAM_CHAT_ID env var.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'korelab-cc'
const smClient = new SecretManagerServiceClient()

let _botToken: string | null = null

async function getBotToken(): Promise<string> {
  if (_botToken) return _botToken

  const [version] = await smClient.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/telegram-bot-token/versions/latest`,
  })

  const raw = version.payload?.data
  if (!raw) throw new Error('[telegram] Secret telegram-bot-token is empty')

  _botToken = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf-8')
  return _botToken
}

export type TelegramMessage = {
  chatId: string
  /** HTML-formatted text. Max 4096 chars. */
  text: string
}

export async function sendTelegramMessage(msg: TelegramMessage): Promise<void> {
  const token = await getBotToken()
  const url = `https://api.telegram.org/bot${token}/sendMessage`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: msg.chatId,
      text: msg.text.slice(0, 4096),
      parse_mode: 'HTML',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[telegram] API ${res.status}: ${body}`)
  }
}
