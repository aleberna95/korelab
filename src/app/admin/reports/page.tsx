import { requireAdmin } from '@/lib/auth/guards'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import Link from 'next/link'
import type { Report } from '@/lib/domain/types'

function formatTs(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(ts.toDate())
}

const VISIBILITY_BADGE: Record<Report['visibility'], string> = {
  private: 'bg-gray-100 text-gray-600',
  tokenized: 'bg-blue-100 text-blue-800',
  email: 'bg-purple-100 text-purple-800',
}

export default async function ReportsPage() {
  await requireAdmin()

  const [reports, clients, services] = await Promise.all([
    reportsRepo.list({ limit: 50 }),
    clientsRepo.list(),
    servicesRepo.list({ limit: 200 }),
  ])

  const clientMap = new Map(clients.map((c) => [c.id, c.name]))
  const serviceMap = new Map(services.map((s) => [s.id, s.name]))

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
        <Link
          href="/admin/reports/generate"
          className="btn-primary text-sm"
        >
          Generate report
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No reports yet. Reports are auto-generated monthly or can be created manually.
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Period</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Service</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Client</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Uptime</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Incidents</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Visibility</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Generated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.period.label}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {serviceMap.get(r.serviceId) ?? r.serviceId}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {clientMap.get(r.clientId) ?? r.clientId}
                  </td>
                  <td className="px-4 py-3 font-mono text-green-700">
                    {r.metrics.uptimePct.toFixed(3)}%
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.metrics.incidentCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${VISIBILITY_BADGE[r.visibility]}`}
                    >
                      {r.visibility}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatTs(r.generatedAt as unknown as { toDate(): Date })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/reports/${r.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

