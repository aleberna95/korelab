import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { getOverviewStats, getQuotePaymentStats } from '@/lib/dashboard/queries'
import { formatEUR } from '@/lib/money'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { IncidentList } from '@/components/incidents/IncidentList'
import type { IncidentListItem } from '@/components/incidents/IncidentList'

export const metadata: Metadata = { title: 'Panoramica — Command Center' }

export default async function AdminOverviewPage() {
  await requireAdmin()

  const [{ byState, total, activeIncidents, withoutCheck }, quoteStats] =
    await Promise.all([getOverviewStats(), getQuotePaymentStats()])

  const unhealthy =
    (byState['degraded'] ?? 0) +
    (byState['partial-outage'] ?? 0) +
    (byState['major-outage'] ?? 0)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
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

      {/* Quotes & Payments KPIs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Preventivi &amp; Pagamenti</h2>
          <div className="flex gap-3">
            <Link href="/admin/quotes" className="text-xs text-blue-600 hover:underline">Preventivi →</Link>
            <Link href="/admin/payments" className="text-xs text-blue-600 hover:underline">Pagamenti →</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Bozze" value={quoteStats.quotesByStatus.bozza} accent="gray" />
          <KpiCard label="In approvazione" value={quoteStats.quotesByStatus['in-approvazione']} accent="amber" />
          <KpiCard label="Approvati" value={quoteStats.quotesByStatus.approvato} accent="green" />
          <KpiCard
            label="Incasso atteso 30gg"
            value={formatEUR(quoteStats.incasso30ggCents)}
            accent="blue"
          />
          <KpiCard
            label="Rate in ritardo"
            value={quoteStats.rateInRitardo}
            accent={quoteStats.rateInRitardo > 0 ? 'red' : 'green'}
          />
        </div>
      </section>

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
            incidents={activeIncidents.map((i): IncidentListItem => ({
              id: i.id,
              state: i.state,
              severity: i.severity,
              title: i.title,
              serviceId: i.serviceId,
              startedAt: i.startedAt,
            }))}
            emptyMessage="Nessun incidente attivo — tutti i sistemi operativi."
          />
        </div>
      </section>

      {/* Attention required */}
      {withoutCheck.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Servizi senza check ({withoutCheck.length})
          </h2>
          <div className="bg-white rounded-lg border border-amber-200 px-4 divide-y divide-gray-50">
            {withoutCheck.slice(0, 10).map((svc) => (
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

    </div>
  )
}
