import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN_LOCAL ?? process.env.TELEGRAM_BOT_TOKEN ?? ''
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN non configurato nelle env vars')
  return token
}

export async function POST() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = getBotToken()

    const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''
    if (!chatId) {
      return NextResponse.json({ error: 'ADMIN_TELEGRAM_CHAT_ID non configurato' }, { status: 400 })
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ <b>Command Center</b> — test connessione Telegram OK',
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Telegram API: ${res.status} — ${body}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[test-telegram]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
