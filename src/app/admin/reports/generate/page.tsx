import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import Link from 'next/link'
import { GenerateReportForm } from './GenerateReportForm'

export default async function GenerateReportPage() {
  await requireAdmin()

  const [services, clients] = await Promise.all([
    servicesRepo.list({ limit: 200 }),
    clientsRepo.list(),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/admin/reports" className="text-sm text-gray-500 hover:text-gray-700">
          ← Reports
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">Generate Report</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manually generate a report for any service and date range.
        </p>
      </div>

      <GenerateReportForm
        services={services.map((s) => ({ id: s.id, name: s.name, clientId: s.clientId }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  )
}
