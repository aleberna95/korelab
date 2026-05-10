import { requireAdmin } from '@/lib/auth/guards'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReportVisibilityForm } from './ReportVisibilityForm'

function fmtTs(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(ts.toDate())
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${(sec / 3600).toFixed(1)}h`
}

type Props = { params: Promise<{ id: string }> }

export default async function ReportDetailPage({ params }: Props) {
  await requireAdmin()

  const { id } = await params
  const [report, services, clients] = await Promise.all([
    reportsRepo.getById(id),
    servicesRepo.list({ limit: 200 }),
    clientsRepo.list(),
  ])

  if (!report) notFound()

  const service = services.find((s) => s.id === report.serviceId)
  const client = clients.find((c) => c.id === report.clientId)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/admin/reports" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Reports
        </Link>
        <h1 className="mt-3 text-2xl font-bold">
          {report.period.label} — {service?.name ?? report.serviceId}
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {client?.name ?? report.clientId} ·{' '}
          {new Date(report.period.from.toDate()).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
          {' → '}
          {new Date(report.period.to.toDate()).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
        </p>
      </div>

      {/* Metrics grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Uptime</p>
          <p className="text-2xl font-bold text-green-400">{report.metrics.uptimePct.toFixed(3)}%</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Downtime</p>
          <p className="text-2xl font-bold">{fmtDuration(report.metrics.downtimeSec)}</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Incidents</p>
          <p className="text-2xl font-bold">{report.metrics.incidentCount}</p>
        </div>
        {report.metrics.mttrSec !== undefined && (
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">MTTR</p>
            <p className="text-2xl font-bold">{fmtDuration(report.metrics.mttrSec)}</p>
          </div>
        )}
        {report.metrics.avgResponseMs !== undefined && (
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Avg response</p>
            <p className="text-2xl font-bold">{report.metrics.avgResponseMs}ms</p>
          </div>
        )}
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Checks</p>
          <p className="text-2xl font-bold">{report.metrics.checks.toLocaleString()}</p>
        </div>
      </section>

      {/* Incidents */}
      {report.incidents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Incidents</h2>
          <div className="space-y-2">
            {report.incidents.map((inc) => (
              <div key={inc.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3">
                <div className="flex justify-between items-start gap-3">
                  <p className="font-medium text-sm">{inc.title}</p>
                  <span className="text-xs text-zinc-400 shrink-0 capitalize">{inc.severity}</span>
                </div>
                {inc.publicMessage && (
                  <p className="text-xs text-zinc-400 mt-1">{inc.publicMessage}</p>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  {fmtTs(inc.startedAt as unknown as { toDate(): Date })}
                  {inc.downtimeSec !== undefined && ` · ${fmtDuration(inc.downtimeSec)} downtime`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Maintenance */}
      {report.maintenance.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Maintenance</h2>
          <div className="space-y-2">
            {report.maintenance.map((mw) => (
              <div key={mw.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3">
                <p className="font-medium text-sm">{mw.title}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {fmtTs(mw.startsAt as unknown as { toDate(): Date })}
                  {' → '}
                  {fmtTs(mw.endsAt as unknown as { toDate(): Date })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {(report.notes.client || report.notes.private) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Notes</h2>
          {report.notes.client && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-400 mb-1">Client notes (visible to client)</p>
              <p className="text-sm">{report.notes.client}</p>
            </div>
          )}
          {report.notes.private && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-400 mb-1">Private notes (admin only)</p>
              <p className="text-sm text-zinc-300">{report.notes.private}</p>
            </div>
          )}
        </section>
      )}

      {/* Visibility / settings */}
      <section className="space-y-3 border-t border-zinc-700 pt-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Settings</h2>
        <ReportVisibilityForm reportId={report.id} current={report.visibility} />
      </section>
    </div>
  )
}
