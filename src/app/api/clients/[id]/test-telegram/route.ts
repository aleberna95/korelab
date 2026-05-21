import { NextResponse } from 'next/server'

// Per-client Telegram chat IDs were removed in Phase 17.
// Alerts now go to the admin bot chat configured via TELEGRAM_CHAT_ID env var.
export async function POST() {
  return NextResponse.json({ error: 'Endpoint rimosso. Le notifiche vanno al chat admin.' }, { status: 410 })
}
