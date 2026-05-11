'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { revalidatePath } from 'next/cache'
import type { UpdateClientInput } from '@/lib/domain/schemas/client'

export async function updateClient(id: string, patch: UpdateClientInput): Promise<void> {
  const { uid } = await requireAdmin()
  await clientsRepo.update(id, patch, uid)
  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
}
