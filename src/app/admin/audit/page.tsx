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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Log di Audit</h1>
        <p className="text-sm text-gray-500 mt-1">Ultime 20 voci.</p>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full min-w-[520px] divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Ora', 'Azione', 'Attore', 'Destinatario'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Nessuna voce.</td>
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
