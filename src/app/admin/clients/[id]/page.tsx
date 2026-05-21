import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import {
  ClientDetail,
  type ClientData,
  type ServiceRow,
  type IncidentRow,
} from './ClientDetail'

export const metadata: Metadata = { title: 'Cliente — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ClientDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [client, services, recentIncidents] = await Promise.all([
    clientsRepo.getById(id),
    servicesRepo.list({ clientId: id, limit: 100 }),
    incidentsRepo.list({ clientId: id, limit: 5 }),
  ])

  if (!client) notFound()

  const clientData: ClientData = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
    tags: client.tags,
    status: client.status,
  }

  const serviceRows: ServiceRow[] = services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    state: svc.currentStatus.state,
    sinceMs: svc.currentStatus.since?.toMillis() ?? 0,
    checkUrl: svc.check?.url,
  }))

  const incidentRows: IncidentRow[] = recentIncidents.map((inc) => ({
    id: inc.id,
    serviceId: inc.serviceId,
    state: inc.state,
    title: inc.title,
    startedAtMs: inc.startedAt.toMillis(),
    resolvedAtMs: inc.resolvedAt?.toMillis(),
  }))

  const serviceNameMap: Record<string, string> = {}
  for (const svc of services) serviceNameMap[svc.id] = svc.name

  return (
    <ClientDetail
      client={clientData}
      initialServices={serviceRows}
      recentIncidents={incidentRows}
      serviceNameMap={serviceNameMap}
    />
  )
}
