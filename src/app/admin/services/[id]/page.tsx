import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { IncidentList, type IncidentListItem } from '@/components/incidents/IncidentList'
import { TaskInlineSection } from '@/components/tasks/TaskInlineSection'

export const metadata: Metadata = { title: 'Servizio — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ServiceDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [service, incidents, tasks, allClients, allServices] = await Promise.all([
    servicesRepo.getById(id),
    incidentsRepo.listByService(id, 20),
    tasksRepo.listTasksByService(id),
    clientsRepo.list(),
    servicesRepo.list(),
  ])
  if (!service) notFound()

  const initialTasks: SerializedTask[] = tasks.map((t) => ({
    id: t.id,
    text: t.text,
    color: t.color,
    order: t.order,
    done: t.done,
    doneAtMs: t.doneAt ? new Date(t.doneAt).getTime() : undefined,
    clientIds: t.clientIds ?? [],
    serviceIds: t.serviceIds ?? [],
    createdAtMs: new Date(t.createdAt).getTime(),
    updatedAtMs: new Date(t.updatedAt).getTime(),
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
        <Link href="/admin/services" className="hover:underline">Servizi</Link>
        {' '}/{' '}
        <span style={{ color: 'var(--color-fg)' }}>{service.name}</span>
      </nav>

      {/* Header */}
      <header className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-h1">{service.name}</h1>
            <StatusBadge state={service.currentStatus.state} />
          </div>
          <p className="text-sm capitalize" style={{ color: 'var(--color-fg-muted)' }}>
            {service.environment} · {service.type.replace(/-/g, ' ')} · criticità {service.criticality}
          </p>
          {service.description && (
            <p className="text-sm mt-2" style={{ color: 'var(--color-fg-muted)' }}>
              {service.description}
            </p>
          )}
        </div>
        <Link href={`/admin/services/${id}/edit`} className="btn-secondary text-sm">
          Modifica
        </Link>
      </header>

      {/* Check config */}
      {service.check && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-fg-muted)' }}>
            Monitoraggio
          </h2>
          <div className="rounded-[var(--radius)] bg-[var(--card)] [box-shadow:var(--shadow-card)] px-4 py-3 text-sm space-y-1">
            <p>
              <span style={{ color: 'var(--color-fg-faint)' }}>URL: </span>
              <a href={service.check.url} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                {service.check.url}
              </a>
            </p>
            <p>
              <span style={{ color: 'var(--color-fg-faint)' }}>Intervallo: </span>
              {service.check.intervalSec}s
            </p>
            <p>
              <span style={{ color: 'var(--color-fg-faint)' }}>SSL check: </span>
              {service.check.sslCheck ? 'Sì' : 'No'}
            </p>
            <p>
              <span style={{ color: 'var(--color-fg-faint)' }}>Stato: </span>
              <span style={{ color: service.check.enabled ? 'var(--color-success)' : 'var(--color-fg-faint)' }}>
                {service.check.enabled ? 'Attivo' : 'In pausa'}
              </span>
            </p>
          </div>
        </section>
      )}

      {/* Recent incidents */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-fg-muted)' }}>
          Incidenti recenti
        </h2>
        <div className="rounded-[var(--radius)] bg-[var(--card)] [box-shadow:var(--shadow-card)] px-4">
          <IncidentList
            incidents={incidents.map((i): IncidentListItem => ({
              id: i.id,
              state: i.state,
              severity: i.severity,
              title: i.title,
              serviceId: i.serviceId,
              startedAt: i.startedAt,
            }))}
            emptyMessage="Nessun incidente registrato."
          />
        </div>
      </section>

      {/* Task inline section */}
      <TaskInlineSection
        entityId={id}
        entityType="service"
        entityName={service.name}
        initialTasks={initialTasks}
        availableClients={allClients.map((c) => ({ id: c.id, name: c.name }))}
        availableServices={allServices.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}



