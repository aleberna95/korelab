import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'

export const metadata: Metadata = { title: 'Clients — Command Center' }

const PLAN_STYLES: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500',
  'monitor-only': 'bg-blue-50 text-blue-700',
  'reporting-only': 'bg-purple-50 text-purple-700',
  'managed-support': 'bg-amber-50 text-amber-700',
  'managed-infra': 'bg-orange-50 text-orange-700',
  'auto-healing': 'bg-green-50 text-green-700',
}

export default async function ClientsPage() {
  await requireAdmin()

  const clients = await clientsRepo.list({ status: 'active', limit: 100 })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{clients.length} active client{clients.length !== 1 ? 's' : ''}.</p>
        </div>
        <Link
          href="/admin/onboarding"
          className="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Onboard client
        </Link>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {clients.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-gray-400">No clients yet.</p>
        )}
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/admin/clients/${client.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 group-hover:text-blue-600">{client.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{client.businessType}</p>
            </div>
            <span
              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLAN_STYLES[client.supportPlan] ?? 'bg-gray-100 text-gray-500'}`}
            >
              {client.supportPlan.replace(/-/g, ' ')}
            </span>
            {client.tags.length > 0 && (
              <div className="hidden sm:flex gap-1 shrink-0">
                {client.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
