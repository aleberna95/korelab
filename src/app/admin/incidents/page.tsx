import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { IncidentList, type IncidentListItem } from '@/components/incidents/IncidentList'
import type { Incident } from '@/lib/domain/types'

function toListItem(i: Incident): IncidentListItem {
  return { id: i.id, state: i.state, severity: i.severity, title: i.title, serviceId: i.serviceId, startedAt: i.startedAt.toDate().toISOString() }
}

export const metadata: Metadata = { title: 'Incidents — Command Center' }

export default async function IncidentsPage() {
  await requireAdmin()

  const [active, recent] = await Promise.all([
    cached(
      () => incidentsRepo.listActive(),
      ['incidents', 'active'],
      { tags: [CACHE_TAGS.incidents], revalidate: 15 },
    ),
    cached(
      () => incidentsRepo.list({ limit: 30 }),
      ['incidents', 'recent'],
      { tags: [CACHE_TAGS.incidents], revalidate: 15 },
    ),
  ])

  // Dedupe: recent may include active ones — separate them
  const activeIds = new Set(active.map((i) => i.id))
  const resolved = recent.filter((i) => !activeIds.has(i.id))

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      <header>
        <h1 className="text-display font-bold text-[var(--color-fg)]">Incidenti</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">Incidenti attivi e storico recente.</p>
      </header>

      {/* Active */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-widest mb-3">
          Attivi ({active.length})
        </h2>
        <div className="bg-[var(--color-surface)] rounded-[var(--radius)] border border-[var(--color-border)] px-4">
          <IncidentList
            incidents={active.map(toListItem)}
            emptyMessage="Nessun incidente attivo — tutti i sistemi operativi."
          />
        </div>
      </section>

      {/* Recent resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-widest mb-3">
            Recenti ({resolved.length})
          </h2>
          <div className="bg-[var(--color-surface)] rounded-[var(--radius)] border border-[var(--color-border)] px-4">
            <IncidentList incidents={resolved.map(toListItem)} />
          </div>
        </section>
      )}
    </div>
  )
}
