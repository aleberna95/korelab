'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import type { UpdateMonitorInput } from '@/lib/domain/schemas/monitor'

export async function updateMonitor(id: string, patch: UpdateMonitorInput): Promise<void> {
  const { uid } = await requireAdmin()
  await monitorsRepo.update(id, patch, uid)
  revalidateTag(CACHE_TAGS.monitors)
  revalidateTag(CACHE_TAGS.audit)
  revalidatePath('/admin/monitors')
  revalidatePath(`/admin/monitors/${id}`)
}

export async function toggleMonitor(id: string, active: boolean): Promise<void> {
  const { uid } = await requireAdmin()
  await monitorsRepo.update(id, { active }, uid)
  revalidateTag(CACHE_TAGS.monitors)
  revalidateTag(CACHE_TAGS.audit)
  revalidatePath('/admin/monitors')
  revalidatePath(`/admin/monitors/${id}`)
}

export async function deleteMonitor(id: string): Promise<void> {
  await requireAdmin()
  await monitorsRepo.delete(id)
  revalidateTag(CACHE_TAGS.monitors)
  revalidateTag(CACHE_TAGS.audit)
  revalidatePath('/admin/monitors')
  redirect('/admin/monitors')
}
