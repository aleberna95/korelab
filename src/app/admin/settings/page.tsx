import type { Metadata } from 'next'
import React from 'react'
import { requireAdmin } from '@/lib/auth/guards'
import { verifySessionCookie } from '@/lib/auth/session'
import { TestTelegramButton } from './TestTelegramButton'
import { version } from '../../../../package.json'

export const metadata: Metadata = { title: 'Settings — Command Center' }

type IntegrationStatus = 'ok' | 'error' | 'unknown'

async function pingTelegram(): Promise<IntegrationStatus> {
  try {
    const res = await fetch('https://api.telegram.org/botplaceholder/getMe', {
      signal: AbortSignal.timeout(3000),
    })
    // Telegram returns 404 for malformed token but the endpoint is reachable
    return res.status === 200 || res.status === 401 || res.status === 404 ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

const TRAFFIC_LIGHT: Record<IntegrationStatus, { dot: string; label: string }> = {
  ok: { dot: 'bg-green-500', label: 'Raggiungibile' },
  error: { dot: 'bg-red-500', label: 'Non raggiungibile' },
  unknown: { dot: 'bg-gray-300', label: 'Sconosciuto' },
}

export default async function SettingsPage() {
  await requireAdmin()
  const session = await verifySessionCookie()

  const telegramStatus = await pingTelegram()

  const integrations = [
    { name: 'Telegram Bot API', status: telegramStatus, note: 'Bot token via Secret Manager' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
      </header>

      {/* Profile */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Account admin</h2>
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-2 text-sm">
          <p className="text-gray-600">UID: <span className="font-mono text-gray-900">{session?.uid ?? '—'}</span></p>
          <p className="text-gray-600">Ruolo: <span className="font-medium text-gray-900">{session?.role ?? '—'}</span></p>
          <p className="text-gray-500 text-xs">MFA status is managed via Firebase Authentication console.</p>
        </div>
      </section>

      {/* Integration health */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Stato integrazioni</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {integrations.map((int) => {
            const tl = TRAFFIC_LIGHT[int.status]
            return (
              <React.Fragment key={int.name}>
                <div className="flex items-center gap-4 px-5 py-3.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tl.dot}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{int.name}</p>
                    <p className="text-xs text-gray-400">{int.note}</p>
                  </div>
                  <span className="text-xs text-gray-500">{tl.label}</span>
                </div>
                {int.name === 'Telegram Bot API' && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <TestTelegramButton />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Connectivity check uses placeholder credentials — a reachable endpoint (200/401) confirms the service is up.
        </p>
      </section>

      {/* App info */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Applicazione</h2>
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 text-sm">
          <p className="text-gray-600">Versione: <span className="font-mono text-gray-900">v{version}</span></p>
        </div>
      </section>
    </div>
  )
}
