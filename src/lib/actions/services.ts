'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { revalidateTag, revalidatePath } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import type { CreateServiceInput, UpdateServiceInput } from '@/lib/domain/schemas/service'

/**
 * Create or update a service.
 * - id = null  → create
 * - id = string → update
 * Returns the service id.
 */
export async function upsertService(
  id: string | null,
  data: CreateServiceInput | UpdateServiceInput,
): Promise<string> {
  const { uid } = await requireAdmin()

  if (id) {
    await servicesRepo.update(id, data as UpdateServiceInput, uid)
    revalidateTag(CACHE_TAGS.services)
    revalidatePath(`/admin/services/${id}`)
    revalidatePath('/admin/services')
    return id
  } else {
    const service = await servicesRepo.create(data as CreateServiceInput, uid)
    revalidateTag(CACHE_TAGS.services)
    revalidatePath('/admin/services')
    return service.id
  }
}
