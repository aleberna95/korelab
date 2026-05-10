'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CreateRunbookInput, UpdateRunbookInput } from '@/lib/domain/schemas/runbook'

export async function createRunbook(input: CreateRunbookInput): Promise<string> {
  const { uid } = await requireAdmin()
  const rb = await runbooksRepo.create(input, uid)
  revalidatePath('/admin/runbooks')
  return rb.id
}

export async function updateRunbook(id: string, patch: UpdateRunbookInput): Promise<void> {
  const { uid } = await requireAdmin()
  await runbooksRepo.update(id, patch, uid)
  revalidatePath('/admin/runbooks')
  revalidatePath(`/admin/runbooks/${id}`)
}

export async function deleteRunbook(id: string): Promise<void> {
  await requireAdmin()
  await runbooksRepo.delete(id)
  revalidatePath('/admin/runbooks')
  redirect('/admin/runbooks')
}
