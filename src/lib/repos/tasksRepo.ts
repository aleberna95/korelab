import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/lib/domain/schemas/task'
import type { Task } from '@/lib/domain/types'

const COLLECTION = 'tasks'
const converter = makeDocConverter<Task>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export const tasksRepo = {
  /** List all tasks, optionally filtered by done state, sorted by order desc */
  async listTasks(done?: boolean): Promise<Task[]> {
    let q = col() as FirebaseFirestore.Query<Task>
    if (done !== undefined) q = q.where('done', '==', done)
    q = q.orderBy('order', 'desc').limit(200)
    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const validated = CreateTaskSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()
    await ref.set({
      text: validated.text,
      color: validated.color,
      order: validated.order,
      done: false,
      clientIds: validated.clientIds ?? [],
      serviceIds: validated.serviceIds ?? [],
      createdAt: now,
      updatedAt: now,
    } as unknown as Task)
    const snap = await ref.get()
    return snap.data()!
  },

  async listTasksByClient(clientId: string): Promise<Task[]> {
    const snap = await col()
      .where('clientIds', 'array-contains', clientId)
      .orderBy('order', 'desc')
      .limit(200)
      .get()
    return snap.docs.map((d) => d.data())
  },

  async listTasksByService(serviceId: string): Promise<Task[]> {
    const snap = await col()
      .where('serviceIds', 'array-contains', serviceId)
      .orderBy('order', 'desc')
      .limit(200)
      .get()
    return snap.docs.map((d) => d.data())
  },

  async updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
    const updates: Record<string, unknown> = {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (patch.done === true) {
      updates.doneAt = FieldValue.serverTimestamp()
    } else if (patch.done === false) {
      updates.doneAt = FieldValue.delete()
    }
    await col().doc(id).update(updates)
  },

  async deleteTask(id: string): Promise<void> {
    await col().doc(id).delete()
  },

  /**
   * Move a task between two neighbours.
   * newOrder = round((beforeOrder + afterOrder) / 2).
   * If beforeOrder === afterOrder the orders have converged — a full rebalance
   * would be needed; for now we just use beforeOrder + 1 as a safe fallback.
   */
  async reorderTask(id: string, beforeOrder: number, afterOrder: number): Promise<void> {
    const mid = Math.round((beforeOrder + afterOrder) / 2)
    const newOrder = mid === beforeOrder || mid === afterOrder ? beforeOrder + 1 : mid
    await col().doc(id).update({
      order: newOrder,
      updatedAt: FieldValue.serverTimestamp(),
    })
  },
}
