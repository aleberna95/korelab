import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { getOverviewStats } from '@/lib/dashboard/queries'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { IncidentList } from '@/components/incidents/IncidentList'

export const metadata: Metadata = { title: 'Panoramica — Command Center' }

export default async function AdminOverviewPage() {
  await requireAdmin()

  const { byState, total, activeIncidents, withoutMonitor, recentAudit } =
    await getOverviewStats()

  const unhealthy =
    (byState['degraded'] ?? 0) +
    (byState['partial-outage'] ?? 0) +
    (byState['major-outage'] ?? 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Panoramica</h1>
        <p className="text-sm text-gray-500 mt-1">Command Center — stato generale a colpo d'occhio.</p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Servizi totali" value={total} accent="blue" />
        <KpiCard
          label="Operativi"
          value={byState['operational'] ?? 0}
          accent="green"
          sub={`${total > 0 ? Math.round(((byState['operational'] ?? 0) / total) * 100) : 0}%`}
        />
        <KpiCard
          label="Non operativi"
          value={unhealthy}
          accent={unhealthy > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Incidenti attivi"
          value={activeIncidents.length}
          accent={activeIncidents.length > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Active incidents */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Incidenti Attivi
          </h2>
          <Link href="/admin/incidents" className="text-xs text-blue-600 hover:underline">
            Vedi tutti →
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4">
          <IncidentList
            incidents={activeIncidents}
            emptyMessage="Nessun incidente attivo — tutti i sistemi operativi."
          />
        </div>
      </section>

      {/* Attention required */}
      {withoutMonitor.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Servizi senza monitor ({withoutMonitor.length})
          </h2>
          <div className="bg-white rounded-lg border border-amber-200 px-4 divide-y divide-gray-50">
            {withoutMonitor.slice(0, 10).map((svc) => (
              <Link
                key={svc.id}
                href={`/admin/services/${svc.id}`}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">{svc.name}</span>
                <span className="text-xs text-gray-400 capitalize">{svc.environment}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent audit */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Attività Recente
          </h2>
          <Link href="/admin/audit" className="text-xs text-blue-600 hover:underline">
            Vedi tutti →
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
          {recentAudit.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Nessun evento di audit.</p>
          )}
          {recentAudit.map((entry) => (
            <div key={entry.id} className="px-4 py-2.5 flex items-center gap-4">
              <span className="font-mono text-xs text-blue-700 shrink-0">{entry.action}</span>
              <span className="text-xs text-gray-500 flex-1 truncate">
                {entry.targetCollection}/{entry.targetId}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {entry.actorKind === 'user' ? '👤' : '⚙️'} {entry.actorUid ?? 'system'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
