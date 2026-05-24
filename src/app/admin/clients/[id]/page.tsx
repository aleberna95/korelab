import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { quotesRepo } from '@/lib/repos/quotesRepo'
import { paymentsRepo } from '@/lib/repos/paymentsRepo'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import {
  ClientDetail,
  type ClientData,
  type ServiceRow,
  type IncidentRow,
  type QuoteRow,
  type PaymentRow,
} from './ClientDetail'

export const metadata: Metadata = { title: 'Cliente — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ClientDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [client, services, recentIncidents, tasks, allClients, allServices, quotes, payments] = await Promise.all([
    clientsRepo.getById(id),
    servicesRepo.list({ clientId: id, limit: 100 }),
    incidentsRepo.list({ clientId: id, limit: 5 }),
    tasksRepo.listTasksByClient(id),
    clientsRepo.list(),
    servicesRepo.list(),
    quotesRepo.list({ clientId: id, limit: 50 }),
    paymentsRepo.list({ clientId: id, limit: 50 }),
  ])

  if (!client) notFound()

  const clientData: ClientData = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    vatNumber: client.vatNumber,
    taxCode: client.taxCode,
    address: client.address,
    pec: client.pec,
    sdi: client.sdi,
    notes: client.notes,
    tags: client.tags,
    status: client.status,
  }

  const serviceRows: ServiceRow[] = services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    state: svc.currentStatus.state,
    sinceMs: svc.currentStatus.since ? new Date(svc.currentStatus.since).getTime() : 0,
    checkUrl: svc.check?.url,
  }))

  const incidentRows: IncidentRow[] = recentIncidents.map((inc) => ({
    id: inc.id,
    serviceId: inc.serviceId,
    state: inc.state,
    title: inc.title,
    startedAtMs: new Date(inc.startedAt).getTime(),
    resolvedAtMs: inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : undefined,
  }))

  const quoteRows: QuoteRow[] = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    status: q.status,
    totalCents: q.totals.totalCents,
    createdAtMs: new Date(q.createdAt).getTime(),
  }))

  const paymentRows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    number: p.number,
    quoteNumber: p.quoteNumber,
    totalCents: p.totalCents,
    status: p.status,
    paidCount: p.installments.filter((i) => i.status === 'paid').length,
    totalCount: p.installments.length,
  }))

  const serviceNameMap: Record<string, string> = {}
  for (const svc of services) serviceNameMap[svc.id] = svc.name

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
    <ClientDetail
      client={clientData}
      initialServices={serviceRows}
      recentIncidents={incidentRows}
      serviceNameMap={serviceNameMap}
      initialTasks={initialTasks}
      availableClients={allClients.map((c) => ({ id: c.id, name: c.name }))}
      availableServices={allServices.map((s) => ({ id: s.id, name: s.name }))}
      quotes={quoteRows}
      payments={paymentRows}
    />
  )
}
