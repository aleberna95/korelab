import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { ServiceForm, type ServiceFormData } from './ServiceForm'
import { DeleteServiceButton } from './DeleteServiceButton'

export const metadata: Metadata = { title: 'Edit Service — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function EditServicePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const service = await servicesRepo.getById(id)
  if (!service) notFound()

  const serviceData: ServiceFormData = {
    id: service.id,
    name: service.name,
    type: service.type,
    environment: service.environment,
    criticality: service.criticality,
    tags: service.tags,
    description: service.description,
    url: service.url,
    healthcheckUrl: service.healthcheckUrl,
    statusPageVisibility: service.statusPageVisibility,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href={`/admin/services/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {service.name}
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">Modifica Servizio</h1>
      </div>

      <ServiceForm service={serviceData} />

      <div className="border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-500 mb-3">Zona pericolosa</p>
        <DeleteServiceButton serviceId={service.id} />
      </div>
    </div>
  )
}
