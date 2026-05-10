import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateResourceSchema,
  UpdateResourceSchema,
  type CreateResourceInput,
  type UpdateResourceInput,
} from '@/lib/domain/schemas/resource'
import type { Resource, ResourceKind } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'resources'
const converter = makeDocConverter<Resource>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type ResourceFilters = {
  clientId?: string
  kind?: ResourceKind
  tag?: string
  limit?: number
}

export const resourcesRepo = {
  async getById(id: string): Promise<Resource | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async listByIds(ids: string[]): Promise<Resource[]> {
    if (ids.length === 0) return []
    const snaps = await Promise.all(ids.map((id) => col().doc(id).get()))
    return snaps.filter((s) => s.exists).map((s) => s.data()!)
  },

  async list(filters: ResourceFilters = {}): Promise<Resource[]> {
    let q = col().orderBy('name') as FirebaseFirestore.Query<Resource>

    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.kind) q = q.where('kind', '==', filters.kind)
    if (filters.tag) q = q.where('tags', 'array-contains', filters.tag)
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateResourceInput, actorUid?: string): Promise<Resource> {
    const validated = CreateResourceSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({ ...validated, id: ref.id, createdAt: now, updatedAt: now } as unknown as Resource)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'resources.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateResourceInput, actorUid?: string): Promise<void> {
    const validated = UpdateResourceSchema.parse(patch)
    await col().doc(id).update({ ...validated, updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'resources.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'resources.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
