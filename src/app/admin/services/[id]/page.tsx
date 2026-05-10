import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { resourcesRepo } from '@/lib/repos/resourcesRepo'
import { dependenciesRepo } from '@/lib/repos/dependenciesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { DependencyGraph } from '@/components/dashboard/DependencyGraph'
import { IncidentList } from '@/components/incidents/IncidentList'

export const metadata: Metadata = { title: 'Service — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ServiceDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const service = await servicesRepo.getById(id)
  if (!service) notFound()

  const [monitors, resources, outbound, inbound, incidents, runbooks] = await Promise.all([
    monitorsRepo.listByIds(service.monitorIds),
    resourcesRepo.listByIds(service.resourceIds),
    dependenciesRepo.listOutbound(id),
    dependenciesRepo.listInbound(id),
    incidentsRepo.listByService(id, 20),
    runbooksRepo.listByIds(service.runbookIds),
  ])

  // Build label map for dependency graph
  const nodeLabels: Record<string, string> = { [id]: service.name }
  for (const r of resources) nodeLabels[r.id] = r.name
  // For service dependencies, we need service names — fetch minimally
  const svcDepIds = [
    ...outbound.filter((d) => d.toKind === 'service').map((d) => d.toId),
    ...inbound.filter((d) => d.fromKind === 'service').map((d) => d.fromId),
  ].filter((did) => !nodeLabels[did])
  if (svcDepIds.length > 0) {
    await Promise.all(
      svcDepIds.map(async (did) => {
        const s = await servicesRepo.getById(did)
        if (s) nodeLabels[did] = s.name
      }),
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/admin/services" className="hover:underline">Services</Link>
        {' '}/{' '}
        <span className="text-gray-900">{service.name}</span>
      </nav>

      {/* Header */}
      <header className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
            <StatusBadge state={service.currentStatus.state} />
          </div>
          <p className="text-sm text-gray-500 capitalize">
            {service.environment} · {service.type.replace(/-/g, ' ')} · {service.criticality} criticality
          </p>
          {service.description && (
            <p className="text-sm text-gray-600 mt-2">{service.description}</p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* URLs */}
          {Object.values(service.urls).some(Boolean) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">URLs</h2>
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(service.urls).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-gray-400 capitalize">{k}</dt>
                    <dd>
                      <a href={v!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-[200px]">
                        {v}
                      </a>
                    </dd>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Monitors */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Monitors ({monitors.length})
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {monitors.length === 0 && (
                <p className="px-4 py-6 text-sm text-amber-600 text-center">No monitors configured.</p>
              )}
              {monitors.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 capitalize">{m.source.replace(/-/g, ' ')}</p>
                    <p className="text-xs text-gray-400 truncate">{m.config.url ?? '—'}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.lastResult === 'up'
                        ? 'bg-green-100 text-green-700'
                        : m.lastResult === 'down'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {m.lastResult ?? 'pending'}
                  </span>
                  <span className={`text-xs ${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.active ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Resources */}
          {resources.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Resources ({resources.length})
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                {resources.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{r.kind.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent incidents */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Recent Incidents
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4">
              <IncidentList
                incidents={incidents}
                emptyMessage="No incidents recorded."
              />
            </div>
          </section>
        </div>

        {/* Right col (1/3) */}
        <div className="space-y-6">
          {/* Access */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Access</h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm space-y-1.5">
              <p className="text-gray-600">
                Level: <span className="font-medium capitalize">{service.access.level}</span>
              </p>
              {service.access.providers.length > 0 && (
                <p className="text-xs text-gray-400">{service.access.providers.join(', ')}</p>
              )}
              {service.access.notes && (
                <p className="text-xs text-gray-500 italic">{service.access.notes}</p>
              )}
            </div>
          </section>

          {/* Runbooks */}
          {runbooks.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Runbooks</h2>
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                {runbooks.map((rb) => (
                  <div key={rb.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{rb.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rb.recoverySteps.length} steps · {rb.commonFailures.length} scenarios
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dependency graph */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Dependencies
            </h2>
            <DependencyGraph
              service={service}
              outbound={outbound}
              inbound={inbound}
              nodeLabels={nodeLabels}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
