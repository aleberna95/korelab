import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { ClientsList } from '@/components/clients/ClientsList'

export const metadata: Metadata = { title: 'Clienti — Command Center' }

export default async function ClientsPage() {
  await requireAdmin()
  const clients = await clientsRepo.list({ limit: 200 })
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <ClientsList initialClients={clients} />
    </div>
  )
}
