import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { ClientForm } from '@/components/clients/ClientForm'

export const metadata: Metadata = { title: 'Modifica cliente — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function EditClientPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const client = await clientsRepo.getById(id)
  if (!client) notFound()

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <Link
          href={`/admin/clients/${id}`}
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
        >
          ← {client.name}
        </Link>
        <h1 className="text-h1 font-semibold text-[var(--color-fg)] mt-3">Modifica cliente</h1>
      </div>
      <ClientForm
        id={client.id}
        initial={{
          name: client.name,
          email: client.email,
          phone: client.phone,
          notes: client.notes,
          tags: client.tags,
          status: client.status,
        }}
      />
    </div>
  )
}
