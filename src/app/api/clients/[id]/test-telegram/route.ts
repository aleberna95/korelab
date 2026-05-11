import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { getAdminDb } from '@/lib/firebase/admin'

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN_LOCAL ?? process.env.TELEGRAM_BOT_TOKEN ?? ''
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN non configurato nelle env vars')
  return token
}

type Props = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Props) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const client = await clientsRepo.getById(id)
  if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })

  if (!client.telegramChatId) {
    return NextResponse.json({ error: 'Nessun Telegram Chat ID configurato per questo cliente' }, { status: 400 })
  }

  try {
    const token = getBotToken()
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: client.telegramChatId,
        text: `✅ <b>Command Center</b> — test notifica per <b>${client.name}</b>\n\nSe vedi questo messaggio, le notifiche Telegram funzionano correttamente.`,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Telegram API: ${res.status} — ${body}` }, { status: 502 })
    }

    // Log to audit
    const db = getAdminDb()
    await db.collection('auditLog').add({
      at: new Date(),
      actorKind: 'user',
      action: 'clients.testTelegram',
      targetCollection: 'clients',
      targetId: id,
      metadata: { clientName: client.name },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[test-telegram]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
