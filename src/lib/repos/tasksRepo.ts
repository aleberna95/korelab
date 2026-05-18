import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/lib/domain/schemas/task'
import type { Task } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'tasks'
const converter = makeDocConverter<Task>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type TaskFilters = {
  serviceId?: string
  incidentId?: string
  runbookId?: string
  state?: Task['state']
  limit?: number
}

export const tasksRepo = {
  async getById(id: string): Promise<Task | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: TaskFilters = {}): Promise<Task[]> {
    let q = col().orderBy('createdAt', 'desc') as FirebaseFirestore.Query<Task>

    if (filters.serviceId) q = q.where('serviceId', '==', filters.serviceId)
    if (filters.incidentId) q = q.where('incidentId', '==', filters.incidentId)
    if (filters.runbookId) q = q.where('runbookId', '==', filters.runbookId)
    if (filters.state) q = q.where('state', '==', filters.state)
    q = q.limit(filters.limit ?? 50)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async listOpen(): Promise<Task[]> {
    const snap = await col()
      .where('state', 'in', ['todo', 'doing'])
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateTaskInput, actorUid?: string): Promise<Task> {
    const validated = CreateTaskSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    const { dueAt, ...rest } = validated
    const doc: Record<string, unknown> = {
      ...rest,
      id: ref.id,
      createdAt: now,
    }
    if (dueAt) doc.dueAt = new Date(dueAt)

    await ref.set(doc as unknown as Task)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'tasks.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateTaskInput, actorUid?: string): Promise<void> {
    const validated = UpdateTaskSchema.parse(patch)
    const { dueAt, ...rest } = validated
    const updates: Record<string, unknown> = { ...rest }

    if (dueAt !== undefined) updates.dueAt = dueAt ? new Date(dueAt) : null
    if (validated.state === 'done') updates.completedAt = FieldValue.serverTimestamp()

    await col().doc(id).update(updates)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'tasks.update',
      targetCollection: COLLECTION,
      targetId: id,
      metadata: { fields: Object.keys(validated) },
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'tasks.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
