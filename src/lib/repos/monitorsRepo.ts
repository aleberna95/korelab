import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateMonitorSchema,
  UpdateMonitorSchema,
  type CreateMonitorInput,
  type UpdateMonitorInput,
} from '@/lib/domain/schemas/monitor'
import type { Monitor, MonitorSource } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'monitors'
const converter = makeDocConverter<Monitor>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type MonitorFilters = {
  serviceId?: string
  clientId?: string
  source?: MonitorSource
  active?: boolean
  limit?: number
}

export const monitorsRepo = {
  async getById(id: string): Promise<Monitor | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async listByIds(ids: string[]): Promise<Monitor[]> {
    if (ids.length === 0) return []
    const snaps = await Promise.all(ids.map((id) => col().doc(id).get()))
    return snaps.filter((s) => s.exists).map((s) => s.data()!)
  },

  async list(filters: MonitorFilters = {}): Promise<Monitor[]> {
    let q = col() as FirebaseFirestore.Query<Monitor>

    if (filters.serviceId) q = q.where('serviceId', '==', filters.serviceId)
    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.source) q = q.where('source', '==', filters.source)
    if (filters.active !== undefined) {
      q = q.where('active', '==', filters.active).orderBy('lastCheckAt', 'asc')
    }
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async listActiveInternal(): Promise<Monitor[]> {
    const snap = await col()
      .where('active', '==', true)
      .where('source', 'in', [
        'internal-http',
        'internal-ssl',
        'internal-dns',
        'internal-domain',
      ])
      .orderBy('lastCheckAt', 'asc')
      .get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateMonitorInput, actorUid?: string): Promise<Monitor> {
    const validated = CreateMonitorSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({ ...validated, id: ref.id, createdAt: now, updatedAt: now } as unknown as Monitor)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'monitors.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateMonitorInput, actorUid?: string): Promise<void> {
    const validated = UpdateMonitorSchema.parse(patch)
    await col().doc(id).update({ ...validated, updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'monitors.update',
      targetCollection: COLLECTION,
      targetId: id,
      metadata: { fields: Object.keys(validated) },
    })
  },

  async recordCheckResult(
    id: string,
    result: Monitor['lastResult'],
  ): Promise<void> {
    await getAdminDb()
      .collection(COLLECTION)
      .doc(id)
      .update({
        lastResult: result,
        lastCheckAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'monitors.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
