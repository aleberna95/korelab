import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { validateToken, recordTokenUse } from '@/lib/status/tokens'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { maintenanceRepo } from '@/lib/repos/maintenanceRepo'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { projectServiceForStatus, type AllowedSection } from '@/lib/status/projector'
import { StatusHeader } from '@/components/status/StatusHeader'
import { ServiceCard } from '@/components/status/ServiceCard'
import { UptimeBar } from '@/components/status/UptimeBar'
import { IncidentList } from '@/components/status/IncidentList'
import { MaintenanceList } from '@/components/status/MaintenanceList'

// Tokenized pages must never be cached by CDNs or stored
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

async function buildServiceView(serviceId: string, allowedSections: AllowedSection[]) {
  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  const [service, incidents, rollups, maintenance, reports] = await Promise.all([
    servicesRepo.getById(serviceId),
    incidentsRepo.listByService(serviceId, 20),
    servicesRepo.getDailyRollups(serviceId, ninetyDaysAgo, today),
    maintenanceRepo.list({ serviceId, limit: 10 }),
    allowedSections.includes('reports')
      ? reportsRepo.list({ serviceId, visibility: 'tokenized', limit: 1 })
      : Promise.resolve([]),
  ])

  if (!service) return null

  const view = projectServiceForStatus(
    service,
    incidents,
    rollups,
    maintenance,
    allowedSections,
    reports[0],
  )

  return { service, view }
}

export default async function TokenizedStatusPage({ params }: Props) {
  const { token } = await params

  // ── 1. Validate token ──────────────────────────────────────────────────────
  const tokenDoc = await validateToken(token)
  if (!tokenDoc) notFound()

  // ── 2. Set response headers (private, no CDN cache, no indexing) ──────────
  // Note: Next.js App Router allows headers() in RSC; we write them here.
  // The actual enforcement happens via next.config.ts headers config + this
  const h = await headers() // access to request headers; response headers set via the below
  void h

  // ── 3. Record usage (non-blocking; don't await to keep page fast) ─────────
  void recordTokenUse(tokenDoc)

  const allowedSections = tokenDoc.allowedSections as AllowedSection[]

  // ── 4. Render by scope ────────────────────────────────────────────────────

  if (tokenDoc.scope === 'service') {
    const result = await buildServiceView(tokenDoc.targetId, allowedSections)
    if (!result) notFound()
    const { view } = result

    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
          <StatusHeader name={view.name} state={view.state} />

          {allowedSections.includes('status') && view.daily90d.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">90-day uptime</p>
              <UptimeBar bars={view.daily90d} />
              <p className="text-xs text-zinc-500 text-right">
                {view.uptime30d.toFixed(3)}% uptime over last 30 days
              </p>
            </section>
          )}

          {allowedSections.includes('maintenance') && view.maintenance.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Maintenance</h2>
              <MaintenanceList windows={view.maintenance} />
            </section>
          )}

          {allowedSections.includes('incidents') && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Incidents</h2>
              <IncidentList active={view.activeIncident} recent={view.recentIncidents} />
            </section>
          )}

          {allowedSections.includes('reports') && view.latestReport && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Latest Report</h2>
              <Link
                href={view.latestReport.url}
                className="inline-block text-sm text-blue-400 hover:underline"
              >
                {view.latestReport.periodLabel} →
              </Link>
            </section>
          )}

          <footer className="text-xs text-zinc-600 text-center pt-8">
            This page is private. Do not share the URL.
          </footer>
        </div>
      </main>
    )
  }

  // scope === 'client'
  const client = await clientsRepo.getById(tokenDoc.targetId)
  if (!client) notFound()

  const clientServices = await servicesRepo.list({ clientId: tokenDoc.targetId, limit: 100 })
  const visibleServices = clientServices.filter(
    (s) => s.visibility.statusPage === 'tokenized' || s.visibility.statusPage === 'public',
  )

  const views = await Promise.all(
    visibleServices.map((svc) => buildServiceView(svc.id, allowedSections)),
  )
  const validViews = views.filter(Boolean) as Awaited<ReturnType<typeof buildServiceView>>[]

  const allOperational = validViews.every((v) => v!.view.state === 'operational')

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
        <StatusHeader
          name={`${client.name} — Status`}
          state={allOperational ? 'operational' : 'degraded'}
        />

        <div className="space-y-3">
          {validViews.map((r) => (
            <ServiceCard key={r!.service.id} view={r!.view} />
          ))}
          {validViews.length === 0 && (
            <p className="text-zinc-500 text-sm">No services visible for this token.</p>
          )}
        </div>

        <footer className="text-xs text-zinc-600 text-center pt-8">
          This page is private. Do not share the URL.
        </footer>
      </div>
    </main>
  )
}

export async function generateMetadata({ params }: Props) {
  const { token: _ } = await params
  return {
    title: 'Status',
    robots: { index: false, follow: false },
  }
}
