'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import type { UpdateClientInput } from '@/lib/domain/schemas/client'

export async function updateClient(id: string, patch: UpdateClientInput): Promise<void> {
  const { uid } = await requireAdmin()
  await clientsRepo.update(id, patch, uid)
  revalidateTag(CACHE_TAGS.services)
  revalidateTag(CACHE_TAGS.audit)
  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
}
