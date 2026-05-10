'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { UpdateServiceInput } from '@/lib/domain/schemas/service'
import type { CreateMonitorInput } from '@/lib/domain/schemas/monitor'

export async function updateService(id: string, patch: UpdateServiceInput): Promise<void> {
  const { uid } = await requireAdmin()
  await servicesRepo.update(id, patch, uid)
  revalidatePath('/admin/services')
  revalidatePath(`/admin/services/${id}`)
}

export async function deleteService(id: string): Promise<void> {
  await requireAdmin()
  await servicesRepo.delete(id)
  revalidatePath('/admin/services')
  redirect('/admin/services')
}

export async function createMonitorForService(
  serviceId: string,
  clientId: string,
  input: Omit<CreateMonitorInput, 'serviceId' | 'clientId'>,
): Promise<void> {
  const { uid } = await requireAdmin()
  const monitor = await monitorsRepo.create({ ...input, serviceId, clientId }, uid)
  await servicesRepo.addMonitorId(serviceId, monitor.id)
  revalidatePath(`/admin/services/${serviceId}`)
  revalidatePath('/admin/monitors')
}
