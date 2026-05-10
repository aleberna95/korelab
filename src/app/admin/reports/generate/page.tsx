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
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/reports" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Reports
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Generate Report</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manually generate a report for any service and date range.
        </p>
      </div>

      <GenerateReportForm services={services} clients={clients} />
    </div>
  )
}
