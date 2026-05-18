import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { IncidentList, type IncidentListItem } from '@/components/incidents/IncidentList'
import { AddMonitorForm } from './AddMonitorForm'
import { CreateTaskForm } from '@/app/admin/tasks/CreateTaskForm'
import type { Task } from '@/lib/domain/types'

export const metadata: Metadata = { title: 'Service — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ServiceDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const service = await servicesRepo.getById(id)
  if (!service) notFound()

  const [monitors, incidents, tasks] = await Promise.all([
    monitorsRepo.listByIds(service.monitorIds),
    incidentsRepo.listByService(id, 20),
    cached(
      () => tasksRepo.list({ serviceId: id, limit: 50 }),
      ['tasks', 'by-service', id],
      { tags: [CACHE_TAGS.tasks], revalidate: 15 },
    ),
  ])

  const openTasks = tasks.filter((t) => t.state === 'todo' || t.state === 'doing')
  const doneTasks = tasks.filter((t) => t.state === 'done' || t.state === 'cancelled')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/admin/services" className="hover:underline">Servizi</Link>
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
            {service.environment} · {service.type.replace(/-/g, ' ')} · {service.criticality} criticità
          </p>
          {service.description && (
            <p className="text-sm text-gray-600 mt-2">{service.description}</p>
          )}
        </div>
        <Link
          href={`/admin/services/${id}/edit`}
          className="btn-secondary text-sm px-4 py-2"
        >
          Modifica
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* URL */}
          {(service.url || service.healthcheckUrl) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">URLs</h2>
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                {service.url && (
                  <div>
                    <dt className="text-xs text-gray-400">Principale</dt>
                    <dd><a href={service.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-[200px]">{service.url}</a></dd>
                  </div>
                )}
                {service.healthcheckUrl && (
                  <div>
                    <dt className="text-xs text-gray-400">Healthcheck</dt>
                    <dd><a href={service.healthcheckUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-[200px]">{service.healthcheckUrl}</a></dd>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Monitors */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Monitor ({monitors.length})
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {monitors.length === 0 && (
                <p className="px-4 py-6 text-sm text-amber-600 text-center">Nessun monitor configurato.</p>
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
                    {m.lastResult ?? 'in attesa'}
                  </span>
                  <span className={`text-xs ${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.active ? 'Attivo' : 'In pausa'}
                  </span>
                </div>
              ))}
              <AddMonitorForm serviceId={id} clientId={service.clientId} />
            </div>
          </section>

          {/* Recent incidents */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Incidenti recenti
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4">
              <IncidentList
                incidents={incidents.map((i): IncidentListItem => ({
                  id: i.id,
                  state: i.state,
                  severity: i.severity,
                  title: i.title,
                  serviceId: i.serviceId,
                  startedAt: i.startedAt.toDate().toISOString(),
                }))}
                emptyMessage="Nessun incidente registrato."
              />
            </div>
          </section>

          {/* Tasks */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Tasks ({openTasks.length} aperti)
            </h2>

            {/* Quick create */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3">
              <CreateTaskForm
                services={[{ id: service.id, name: service.name }]}
                defaultServiceId={service.id}
              />
            </div>

            {/* Open tasks */}
            {openTasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {openTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/admin/tasks/${t.id}`}
                    className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-gray-400 line-clamp-1">{t.description}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        t.state === 'doing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t.state}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {openTasks.length === 0 && (
              <p className="text-sm text-gray-400 px-1">Nessun task aperto.</p>
            )}

            {/* Closed tasks (collapsed) */}
            {doneTasks.length > 0 && (
              <p className="text-xs text-gray-400 px-1">
                + {doneTasks.length} completati/annullati —{' '}
                <Link href={`/admin/tasks?service=${id}`} className="hover:underline text-gray-500">
                  vedi tutti
                </Link>
              </p>
            )}
          </section>
        </div>

        {/* Right col (1/3) */}
        <div className="space-y-6">
          {/* Visibility */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Visibilità</h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm space-y-1.5">
              <p className="text-gray-600">
                Pagina stato: <span className="font-medium capitalize">{service.statusPageVisibility}</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
