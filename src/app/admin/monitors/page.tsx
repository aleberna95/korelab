import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Monitors — Command Center' }

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(ts.toDate())
}

export default async function MonitorsPage() {
  await requireAdmin()

  const monitors = await monitorsRepo.list({ limit: 200 })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Monitors</h1>
        <p className="text-sm text-gray-500 mt-1">{monitors.length} monitor{monitors.length !== 1 ? 's' : ''} configured.</p>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Source', 'Service', 'URL', 'Last result', 'Last check', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monitors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No monitors yet.
                </td>
              </tr>
            )}
            {monitors.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                  {m.source.replace(/-/g, ' ')}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/services/${m.serviceId}`} className="text-sm text-blue-600 hover:underline">
                    {m.serviceId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                  {m.config.url ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.lastResult === 'up'
                        ? 'bg-green-100 text-green-700'
                        : m.lastResult === 'down'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {m.lastResult ?? 'pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {formatTime(m.lastCheckAt as unknown as { toDate(): Date })}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.active ? 'Active' : 'Paused'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
