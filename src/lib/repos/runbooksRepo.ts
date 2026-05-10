import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateRunbookSchema,
  UpdateRunbookSchema,
  type CreateRunbookInput,
  type UpdateRunbookInput,
} from '@/lib/domain/schemas/runbook'
import type { Runbook } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'runbooks'
const converter = makeDocConverter<Runbook>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type RunbookFilters = {
  serviceType?: string
  tag?: string
  limit?: number
}

export const runbooksRepo = {
  async getById(id: string): Promise<Runbook | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async listByIds(ids: string[]): Promise<Runbook[]> {
    if (ids.length === 0) return []
    const snaps = await Promise.all(ids.map((id) => col().doc(id).get()))
    return snaps.filter((s) => s.exists).map((s) => s.data()!)
  },

  async list(filters: RunbookFilters = {}): Promise<Runbook[]> {
    let q = col().orderBy('title') as FirebaseFirestore.Query<Runbook>

    if (filters.serviceType) {
      q = q.where('serviceTypes', 'array-contains', filters.serviceType)
    }
    if (filters.tag) {
      q = q.where('appliesToTags', 'array-contains', filters.tag)
    }
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateRunbookInput, actorUid?: string): Promise<Runbook> {
    const validated = CreateRunbookSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({ ...validated, id: ref.id, createdAt: now, updatedAt: now } as unknown as Runbook)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'runbooks.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateRunbookInput, actorUid?: string): Promise<void> {
    const validated = UpdateRunbookSchema.parse(patch)
    await col().doc(id).update({ ...validated, updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'runbooks.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'runbooks.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
