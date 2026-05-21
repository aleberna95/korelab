import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { ServiceForm } from '@/components/services/ServiceForm'

export const metadata: Metadata = { title: 'Nuovo servizio — Command Center' }

type Props = { searchParams: Promise<{ clientId?: string }> }

export default async function NewServicePage({ searchParams }: Props) {
  await requireAdmin()
  const { clientId } = await searchParams

  const clients = await clientsRepo.list({ limit: 200 })
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <Link
          href={clientId ? `/admin/clients/${clientId}` : '/admin/services'}
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
        >
          ←{' '}
          {clientId
            ? (clients.find((c) => c.id === clientId)?.name ?? 'Cliente')
            : 'Servizi'}
        </Link>
        <h1 className="text-h1 font-semibold text-[var(--color-fg)] mt-3">Nuovo servizio</h1>
      </div>
      <ServiceForm
        clients={clientOptions}
        initial={{ clientId: clientId ?? '' }}
      />
    </div>
  )
}
