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
  private: 'bg-zinc-700 text-zinc-300',
  tokenized: 'bg-blue-900 text-blue-300',
  email: 'bg-purple-900 text-purple-300',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link
          href="/admin/reports/generate"
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Generate report
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          No reports yet. Reports are auto-generated monthly or can be created manually.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-700">
                <th className="pb-3 pr-4">Period</th>
                <th className="pb-3 pr-4">Service</th>
                <th className="pb-3 pr-4">Client</th>
                <th className="pb-3 pr-4">Uptime</th>
                <th className="pb-3 pr-4">Incidents</th>
                <th className="pb-3 pr-4">Visibility</th>
                <th className="pb-3 pr-4">Generated</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/50">
                  <td className="py-3 pr-4 font-medium">{r.period.label}</td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {serviceMap.get(r.serviceId) ?? r.serviceId}
                  </td>
                  <td className="py-3 pr-4 text-zinc-400">
                    {clientMap.get(r.clientId) ?? r.clientId}
                  </td>
                  <td className="py-3 pr-4 font-mono text-green-400">
                    {r.metrics.uptimePct.toFixed(3)}%
                  </td>
                  <td className="py-3 pr-4 text-center">{r.metrics.incidentCount}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${VISIBILITY_BADGE[r.visibility]}`}
                    >
                      {r.visibility}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-500 text-xs">
                    {formatTs(r.generatedAt as unknown as { toDate(): Date })}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/admin/reports/${r.id}`}
                      className="text-xs text-blue-400 hover:underline"
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

