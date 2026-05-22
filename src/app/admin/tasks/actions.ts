'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/domain/schemas/task'

export async function createTask(input: CreateTaskInput): Promise<string> {
  await requireAdmin()
  const task = await tasksRepo.createTask(input)
  revalidateTag(CACHE_TAGS.tasks)
  return task.id
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
  await requireAdmin()
  await tasksRepo.updateTask(id, patch)
  revalidateTag(CACHE_TAGS.tasks)
}

export async function deleteTask(id: string): Promise<void> {
  await requireAdmin()
  await tasksRepo.deleteTask(id)
  revalidateTag(CACHE_TAGS.tasks)
}

/** Alias semantico per aggiornare solo i link cliente/servizio di una task. */
export async function updateTaskLinks(
  id: string,
  links: { clientIds: string[]; serviceIds: string[] },
): Promise<void> {
  return updateTask(id, links)
}

/** Update the order field directly (optimistic reorder). */
export async function reorderTask(id: string, newOrder: number): Promise<void> {
  await requireAdmin()
  await tasksRepo.updateTask(id, { order: newOrder })
}
