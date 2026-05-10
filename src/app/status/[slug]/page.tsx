import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { maintenanceRepo } from '@/lib/repos/maintenanceRepo'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { projectServiceForStatus } from '@/lib/status/projector'
import { StatusHeader } from '@/components/status/StatusHeader'
import { UptimeBar } from '@/components/status/UptimeBar'
import { IncidentList } from '@/components/status/IncidentList'
import { MaintenanceList } from '@/components/status/MaintenanceList'

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const svc = await servicesRepo.getById(slug)
  return {
    title: svc ? `${svc.name} — Status` : 'Service Status',
  }
}

export default async function ServiceStatusPage({ params }: Props) {
  const { slug } = await params

  const service = await servicesRepo.getById(slug)

  // Must be public to appear on this route
  if (!service || service.visibility.statusPage !== 'public') notFound()

  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  const [incidents, rollups, maintenance, reports] = await Promise.all([
    incidentsRepo.listByService(service.id, 20),
    servicesRepo.getDailyRollups(service.id, ninetyDaysAgo, today),
    maintenanceRepo.list({ serviceId: service.id, limit: 10 }),
    reportsRepo.list({ serviceId: service.id, visibility: 'tokenized', limit: 1 }),
  ])

  const view = projectServiceForStatus(
    service,
    incidents,
    rollups,
    maintenance,
    ['status', 'incidents', 'maintenance', 'reports'],
    reports[0],
  )

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
        {/* Back */}
        <Link href="/status" className="text-sm text-gray-500 hover:text-gray-700">
          ← All services
        </Link>

        <StatusHeader name={view.name} state={view.state} description={service.description} />

        {/* Uptime bar */}
        {view.daily90d.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">90-day uptime</p>
            <UptimeBar bars={view.daily90d} />
            <p className="text-xs text-zinc-500 text-right">
              {view.uptime30d.toFixed(3)}% uptime over last 30 days
            </p>
          </section>
        )}

        {/* Maintenance */}
        {view.maintenance.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Maintenance
            </h2>
            <MaintenanceList windows={view.maintenance} />
          </section>
        )}

        {/* Incidents */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Incidents
          </h2>
          <IncidentList active={view.activeIncident} recent={view.recentIncidents} />
        </section>

        <footer className="text-xs text-zinc-600 text-center pt-8">
          Powered by Command Center · Updated every 60s
        </footer>
      </div>
    </main>
  )
}
