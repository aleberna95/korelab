'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { reportsRepo } from '@/lib/repos/reportsRepo'
import { revalidatePath } from 'next/cache'
import type { Report } from '@/lib/domain/types'

export async function updateReportVisibility(
  reportId: string,
  visibility: Report['visibility'],
): Promise<void> {
  const { uid } = await requireAdmin()
  await reportsRepo.update(reportId, { visibility }, uid)
  revalidatePath('/admin/reports')
  revalidatePath(`/admin/reports/${reportId}`)
}
