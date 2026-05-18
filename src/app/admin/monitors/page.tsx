import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Monitors — Command Center' }

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(ts.toDate())
}

export default async function MonitorsPage() {
  await requireAdmin()

  const monitors = await cached(
    () => monitorsRepo.list({ limit: 200 }),
    ['monitors', 'list'],
    { tags: [CACHE_TAGS.monitors], revalidate: 30 },
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Monitors</h1>
        <p className="text-sm text-gray-500 mt-1">{monitors.length} monitor configurati.</p>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full min-w-[640px] divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Sorgente', 'Servizio', 'URL', 'Ultimo risultato', 'Ultimo controllo', 'Stato'].map((h) => (
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
                  Nessun monitor configurato.
                </td>
              </tr>
            )}
            {monitors.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                  <Link href={`/admin/monitors/${m.id}`} className="hover:text-blue-600">
                    {m.source.replace(/-/g, ' ')}
                  </Link>
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
                    {m.lastResult ?? 'in attesa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {formatTime(m.lastCheckAt as unknown as { toDate(): Date })}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.active ? 'Attivo' : 'In pausa'}
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
