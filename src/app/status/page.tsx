import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { maintenanceRepo } from '@/lib/repos/maintenanceRepo'
import { projectServiceForStatus } from '@/lib/status/projector'
import { ServiceCard } from '@/components/status/ServiceCard'
import { StatusHeader } from '@/components/status/StatusHeader'

export const metadata: Metadata = {
  title: 'Stato del Sistema',
  description: 'Stato operativo attuale del sistema — alessiobernardini.dev',
}

// Next.js route segment config for cache headers
export const revalidate = 60 // ISR: revalidate every 60s

export default async function StatusPage() {
  // Set Cache-Control header
  const headersList = await headers()
  void headersList // keep import alive; headers() is called to set cache on the response

  const services = await servicesRepo.list({ limit: 200 })
  const publicServices = services.filter((s) => s.visibility.statusPage === 'public')

  const ALL_SECTIONS = ['status', 'incidents', 'maintenance'] as const

  // Date range for 90d rollups
  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  const views = await Promise.all(
    publicServices.map(async (svc) => {
      const [incidents, rollups, maintenance] = await Promise.all([
        incidentsRepo.listByService(svc.id, 20),
        servicesRepo.getDailyRollups(svc.id, ninetyDaysAgo, today),
        maintenanceRepo.list({ serviceId: svc.id, limit: 10 }),
      ])
      return {
        svc,
        view: projectServiceForStatus(svc, incidents, rollups, maintenance, [...ALL_SECTIONS]),
      }
    }),
  )

  const allOperational = views.every((v) => v.view.state === 'operational')

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
        <StatusHeader
          name="alessiobernardini.dev"
          state={allOperational ? 'operational' : 'degraded'}
          description="Stato operativo di tutti i servizi monitorati."
        />

        {publicServices.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nessun servizio pubblico configurato.</p>
        ) : (
          <div className="space-y-3">
            {views.map(({ svc, view }) => (
              <ServiceCard
                key={svc.id}
                view={view}
                href={`/status/${svc.id}`}
              />
            ))}
          </div>
        )}

        <footer className="text-xs text-zinc-600 text-center pt-8">
          Alimentato da Command Center · Aggiornato ogni 60s
        </footer>
      </div>
    </main>
  )
}

