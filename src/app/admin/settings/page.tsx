import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { verifySessionCookie } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Settings — Command Center' }

type IntegrationStatus = 'ok' | 'error' | 'unknown'

async function pingUptimeRobot(): Promise<IntegrationStatus> {
  try {
    const res = await fetch('https://api.uptimerobot.com/v2/getAccountDetails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'api_key=placeholder&format=json',
      signal: AbortSignal.timeout(3000),
    })
    // 401 means the endpoint is reachable (we don't have the key here)
    return res.status === 200 || res.status === 401 ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

async function pingTelegram(): Promise<IntegrationStatus> {
  try {
    const res = await fetch('https://api.telegram.org/botplaceholder/getMe', {
      signal: AbortSignal.timeout(3000),
    })
    // 401 means endpoint reachable — key is in Secret Manager
    return res.status === 200 || res.status === 401 ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

async function pingResend(): Promise<IntegrationStatus> {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: 'Bearer placeholder' },
      signal: AbortSignal.timeout(3000),
    })
    return res.status === 200 || res.status === 401 ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

const TRAFFIC_LIGHT: Record<IntegrationStatus, { dot: string; label: string }> = {
  ok: { dot: 'bg-green-500', label: 'Reachable' },
  error: { dot: 'bg-red-500', label: 'Unreachable' },
  unknown: { dot: 'bg-gray-300', label: 'Unknown' },
}

export default async function SettingsPage() {
  await requireAdmin()
  const session = await verifySessionCookie()

  const [uptimeRobotStatus, telegramStatus, resendStatus] = await Promise.all([
    pingUptimeRobot(),
    pingTelegram(),
    pingResend(),
  ])

  const integrations = [
    { name: 'UptimeRobot', status: uptimeRobotStatus, note: 'API key via Secret Manager' },
    { name: 'Telegram Bot API', status: telegramStatus, note: 'Bot token via Secret Manager' },
    { name: 'Resend', status: resendStatus, note: 'API key via Secret Manager' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </header>

      {/* Profile */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Admin account</h2>
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-2 text-sm">
          <p className="text-gray-600">UID: <span className="font-mono text-gray-900">{session?.uid ?? '—'}</span></p>
          <p className="text-gray-600">Role: <span className="font-medium text-gray-900">{session?.role ?? '—'}</span></p>
          <p className="text-gray-500 text-xs">MFA status is managed via Firebase Authentication console.</p>
        </div>
      </section>

      {/* Integration health */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Integration health</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {integrations.map((int) => {
            const tl = TRAFFIC_LIGHT[int.status]
            return (
              <div key={int.name} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tl.dot}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{int.name}</p>
                  <p className="text-xs text-gray-400">{int.note}</p>
                </div>
                <span className="text-xs text-gray-500">{tl.label}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Connectivity check uses placeholder credentials — a reachable endpoint (200/401) confirms the service is up.
        </p>
      </section>
    </div>
  )
}
