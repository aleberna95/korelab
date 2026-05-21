import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { computeUptime } from '@/lib/services/uptime'
import { ServicesListView } from '@/components/services/ServicesListView'
import type { ServiceRow } from '@/components/services/ServicesListView'

export const metadata: Metadata = { title: 'Servizi — KoreLab' }

export default async function ServicesPage() {
  await requireAdmin()

  const [services, clients] = await Promise.all([
    cached(
      () => servicesRepo.list({ limit: 200 }),
      ['services', 'list'],
      { tags: [CACHE_TAGS.services], revalidate: 30 },
    ),
    clientsRepo.list({ limit: 200 }),
  ])

  // Compute uptime for all services in parallel
  const uptimes = await Promise.all(services.map((svc) => computeUptime(svc.id, 30)))

  // Serialize to plain objects (avoid passing Timestamp instances to client components)
  const rows: ServiceRow[] = services.map((svc, i) => ({
    id: svc.id,
    name: svc.name,
    clientId: svc.clientId,
    checkUrl: svc.check?.url,
    initialState: svc.currentStatus.state,
    uptime: uptimes[i]!,
  }))

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-h1">Servizi</h1>
        <span className="text-[13px]" style={{ color: 'var(--color-fg-faint)' }}>
          {services.length}
        </span>
      </header>

      <ServicesListView rows={rows} clients={clientOptions} />
    </div>
  )
}

