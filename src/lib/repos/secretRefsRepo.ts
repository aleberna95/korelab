import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateSecretRefSchema,
  UpdateSecretRefSchema,
  type CreateSecretRefInput,
  type UpdateSecretRefInput,
} from '@/lib/domain/schemas/secretRef'
import type { SecretRef } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'secretRefs'
const converter = makeDocConverter<SecretRef>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type SecretRefFilters = {
  clientId?: string
  resourceId?: string
  kind?: SecretRef['kind']
  limit?: number
}

export const secretRefsRepo = {
  async getById(id: string): Promise<SecretRef | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: SecretRefFilters = {}): Promise<SecretRef[]> {
    let q = col().orderBy('name') as FirebaseFirestore.Query<SecretRef>

    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.resourceId) q = q.where('resourceId', '==', filters.resourceId)
    if (filters.kind) q = q.where('kind', '==', filters.kind)
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateSecretRefInput, actorUid?: string): Promise<SecretRef> {
    const validated = CreateSecretRefSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({ ...validated, id: ref.id, createdAt: now, updatedAt: now } as unknown as SecretRef)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'secretRefs.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateSecretRefInput, actorUid?: string): Promise<void> {
    const validated = UpdateSecretRefSchema.parse(patch)
    await col()
      .doc(id)
      .update({ ...validated, updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'secretRefs.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async markRotated(id: string, actorUid?: string): Promise<void> {
    await col()
      .doc(id)
      .update({
        lastRotatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'secretRefs.rotated',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'secretRefs.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
