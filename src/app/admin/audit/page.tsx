import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { auditLogRepo } from '@/lib/repos/auditLogRepo'

export const metadata: Metadata = { title: 'Audit Log — Command Center' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(ts.toDate())
}

export default async function AuditPage({ searchParams }: Props) {
  await requireAdmin()
  const params = await searchParams

  const action = str(params['action'])
  const actorKind = str(params['actorKind']) as 'user' | 'function' | undefined
  const targetCollection = str(params['collection'])

  const entries = await auditLogRepo.list({ action, actorKind, targetCollection, limit: 20 })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Last 20 entries.</p>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Time', 'Action', 'Actor', 'Target'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No entries.</td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                  {formatTime(e.at as unknown as { toDate(): Date })}
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-blue-700">{e.action}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600">
                  {e.actorKind === 'user' ? '👤' : '⚙️'} {e.actorUid ?? 'system'}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {e.targetCollection}/{e.targetId?.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
