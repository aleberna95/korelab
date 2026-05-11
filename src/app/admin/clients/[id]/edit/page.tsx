import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { ClientForm, type ClientFormData } from './ClientForm'

export const metadata: Metadata = { title: 'Edit Client — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function EditClientPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const client = await clientsRepo.getById(id)
  if (!client) notFound()

  const formData: ClientFormData = {
    id: client.id,
    name: client.name,
    businessType: client.businessType,
    contacts: client.contacts,
    telegramChatId: client.telegramChatId,
    supportPlan: client.supportPlan,
    consent: {
      monitoring: client.consent.monitoring,
      notification: client.consent.notification,
    },
    tags: client.tags ?? [],
    notes: client.notes ?? '',
    status: client.status,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href={`/admin/clients/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {client.name}
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">Modifica cliente</h1>
      </div>

      <ClientForm client={formData} />
    </div>
  )
}
