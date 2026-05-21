'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { revalidateTag, revalidatePath } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import type { CreateClientInput, UpdateClientInput } from '@/lib/domain/schemas/client'

/**
 * Create or update a client.
 * - id = null  → create
 * - id = string → update
 * Returns the client id.
 */
export async function upsertClient(
  id: string | null,
  data: CreateClientInput | UpdateClientInput,
): Promise<string> {
  const { uid } = await requireAdmin()

  if (id) {
    await clientsRepo.update(id, data as UpdateClientInput, uid)
    revalidatePath(`/admin/clients/${id}`)
    revalidatePath('/admin/clients')
    return id
  } else {
    const client = await clientsRepo.create(data as CreateClientInput, uid)
    revalidatePath('/admin/clients')
    revalidateTag(CACHE_TAGS.services)
    return client.id
  }
}
