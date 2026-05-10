import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateMaintenanceWindowSchema,
  UpdateMaintenanceWindowSchema,
  type CreateMaintenanceWindowInput,
  type UpdateMaintenanceWindowInput,
} from '@/lib/domain/schemas/maintenance'
import type { MaintenanceWindow } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'maintenanceWindows'
const converter = makeDocConverter<MaintenanceWindow>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export const maintenanceRepo = {
  async getById(id: string): Promise<MaintenanceWindow | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: { clientId?: string; serviceId?: string; limit?: number } = {}): Promise<MaintenanceWindow[]> {
    let q = col().orderBy('startsAt', 'desc') as FirebaseFirestore.Query<MaintenanceWindow>

    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.serviceId) q = q.where('serviceIds', 'array-contains', filters.serviceId)
    q = q.limit(filters.limit ?? 50)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  /** Current or future maintenance windows (startsAt >= now OR endsAt >= now) */
  async listActive(): Promise<MaintenanceWindow[]> {
    const now = new Date()
    const snap = await col()
      .where('endsAt', '>=', now)
      .orderBy('endsAt', 'asc')
      .limit(50)
      .get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: CreateMaintenanceWindowInput, actorUid?: string): Promise<MaintenanceWindow> {
    const validated = CreateMaintenanceWindowSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    // Convert ISO strings to Timestamps for storage
    const { startsAt, endsAt, ...rest } = validated
    await ref.set({
      ...rest,
      id: ref.id,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdAt: now,
      updatedAt: now,
    } as unknown as MaintenanceWindow)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'maintenance.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(
    id: string,
    patch: UpdateMaintenanceWindowInput,
    actorUid?: string,
  ): Promise<void> {
    const validated = UpdateMaintenanceWindowSchema.parse(patch)
    const { startsAt, endsAt, ...rest } = validated
    const updates: Record<string, unknown> = {
      ...rest,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (startsAt) updates.startsAt = new Date(startsAt)
    if (endsAt) updates.endsAt = new Date(endsAt)

    await col().doc(id).update(updates)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'maintenance.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'maintenance.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
