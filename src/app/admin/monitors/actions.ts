'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { UpdateMonitorInput } from '@/lib/domain/schemas/monitor'

export async function updateMonitor(id: string, patch: UpdateMonitorInput): Promise<void> {
  const { uid } = await requireAdmin()
  await monitorsRepo.update(id, patch, uid)
  revalidatePath('/admin/monitors')
  revalidatePath(`/admin/monitors/${id}`)
}

export async function toggleMonitor(id: string, active: boolean): Promise<void> {
  const { uid } = await requireAdmin()
  await monitorsRepo.update(id, { active }, uid)
  revalidatePath('/admin/monitors')
  revalidatePath(`/admin/monitors/${id}`)
}

export async function deleteMonitor(id: string): Promise<void> {
  await requireAdmin()
  await monitorsRepo.delete(id)
  revalidatePath('/admin/monitors')
  redirect('/admin/monitors')
}
