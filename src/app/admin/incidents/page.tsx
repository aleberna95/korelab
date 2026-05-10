import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { IncidentList, type IncidentListItem } from '@/components/incidents/IncidentList'
import type { Incident } from '@/lib/domain/types'

function toListItem(i: Incident): IncidentListItem {
  return { id: i.id, state: i.state, severity: i.severity, title: i.title, serviceId: i.serviceId, startedAt: i.startedAt.toDate().toISOString() }
}

export const metadata: Metadata = { title: 'Incidents — Command Center' }

export default async function IncidentsPage() {
  await requireAdmin()

  const [active, recent] = await Promise.all([
    incidentsRepo.listActive(),
    incidentsRepo.list({ limit: 30 }),
  ])

  // Dedupe: recent may include active ones — separate them
  const activeIds = new Set(active.map((i) => i.id))
  const resolved = recent.filter((i) => !activeIds.has(i.id))

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
        <p className="text-sm text-gray-500 mt-1">Active incidents and recent history.</p>
      </header>

      {/* Active */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Active ({active.length})
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 px-4">
          <IncidentList
            incidents={active.map(toListItem)}
            emptyMessage="No active incidents — all systems operational."
          />
        </div>
      </section>

      {/* Recent resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Recent ({resolved.length})
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 px-4">
            <IncidentList incidents={resolved.map(toListItem)} />
          </div>
        </section>
      )}
    </div>
  )
}
