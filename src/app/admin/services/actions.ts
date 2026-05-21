'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import type { UpdateServiceInput } from '@/lib/domain/schemas/service'

export async function updateService(id: string, patch: UpdateServiceInput): Promise<void> {
  const { uid } = await requireAdmin()
  await servicesRepo.update(id, patch, uid)
  revalidateTag(CACHE_TAGS.services)
  revalidatePath('/admin/services')
  revalidatePath(`/admin/services/${id}`)
}

export async function deleteService(id: string): Promise<void> {
  await requireAdmin()
  await servicesRepo.delete(id)
  revalidateTag(CACHE_TAGS.services)
  revalidatePath('/admin/services')
  redirect('/admin/services')
}
