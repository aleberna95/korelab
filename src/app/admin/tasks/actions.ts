'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { revalidatePath } from 'next/cache'
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/domain/schemas/task'

export async function createTask(input: CreateTaskInput): Promise<string> {
  const { uid } = await requireAdmin()
  const task = await tasksRepo.create(input, uid)
  revalidatePath('/admin/tasks')
  return task.id
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
  const { uid } = await requireAdmin()
  await tasksRepo.update(id, patch, uid)
  revalidatePath('/admin/tasks')
  revalidatePath(`/admin/tasks/${id}`)
}

export async function deleteTask(id: string): Promise<void> {
  const { uid } = await requireAdmin()
  await tasksRepo.delete(id, uid)
  revalidatePath('/admin/tasks')
}
