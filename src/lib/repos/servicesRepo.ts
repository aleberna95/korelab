import 'server-only'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
} from '@/lib/domain/schemas/service'
import type { Service, ServiceStatusState } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'services'
const converter = makeDocConverter<Service>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type ServiceFilters = {
  clientId?: string
  environment?: Service['environment']
  criticality?: Service['criticality']
  state?: ServiceStatusState
  tag?: string
  /** Services with empty monitorIds array */
  hasNoMonitor?: boolean
  /** Services with an active incident */
  hasActiveIncident?: boolean
  limit?: number
}

export const servicesRepo = {
  async getById(id: string): Promise<Service | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  /** Single composed Firestore query per filter combination */
  async list(filters: ServiceFilters = {}): Promise<Service[]> {
    let q = col() as FirebaseFirestore.Query<Service>

    if (filters.clientId) {
      q = q.where('clientId', '==', filters.clientId)
      q = q.orderBy('criticality', 'desc').orderBy('name', 'asc')
    } else if (filters.tag) {
      q = q.where('tags', 'array-contains', filters.tag).orderBy('name')
    } else if (filters.state) {
      q = q
        .where('currentStatus.state', '==', filters.state)
        .orderBy('currentStatus.since', 'desc')
    } else if (filters.hasNoMonitor) {
      // Firestore supports equality match on empty array
      q = q.where('monitorIds', '==', []).orderBy('name')
    } else if (filters.hasActiveIncident) {
      // '!=' is supported in Firestore — filters docs where field is not null/undefined
      q = q
        .where('currentStatus.activeIncidentId', '!=', null)
        .orderBy('currentStatus.activeIncidentId')
        .orderBy('name')
    } else {
      q = q.orderBy('name')
    }

    if (filters.environment) q = q.where('environment', '==', filters.environment)
    if (filters.criticality) q = q.where('criticality', '==', filters.criticality)

    q = q.limit(filters.limit ?? 100)
    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async listByClient(clientId: string): Promise<Service[]> {
    return this.list({ clientId })
  },

  async listByTag(tag: string): Promise<Service[]> {
    return this.list({ tag })
  },

  async listByStatus(state: ServiceStatusState): Promise<Service[]> {
    return this.list({ state })
  },

  async listCritical(): Promise<Service[]> {
    const snap = await col()
      .where('criticality', '==', 'critical')
      .orderBy('currentStatus.state')
      .get()
    return snap.docs.map((d) => d.data())
  },

  async listWithoutMonitor(): Promise<Service[]> {
    return this.list({ hasNoMonitor: true })
  },

  async listWithActiveIncident(): Promise<Service[]> {
    return this.list({ hasActiveIncident: true })
  },

  async create(input: CreateServiceInput, actorUid?: string): Promise<Service> {
    const validated = CreateServiceSchema.parse(input)

    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({
      ...validated,
      id: ref.id,
      currentStatus: {
        ...validated.currentStatus,
        state: validated.currentStatus.state ?? 'unknown',
        since: now,
      },
      createdAt: now,
      updatedAt: now,
    } as unknown as Service)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'services.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(id: string, patch: UpdateServiceInput, actorUid?: string): Promise<void> {
    const validated = UpdateServiceSchema.parse(patch)
    await col()
      .doc(id)
      .update({ ...validated, updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'services.update',
      targetCollection: COLLECTION,
      targetId: id,
      metadata: { fields: Object.keys(validated) },
    })
  },

  async updateStatus(
    id: string,
    state: ServiceStatusState,
    extra: { activeIncidentId?: string | null; lastCheckAt?: boolean } = {},
  ): Promise<void> {
    const db = getAdminDb()
    const update: Record<string, unknown> = {
      'currentStatus.state': state,
      'currentStatus.since': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (extra.activeIncidentId !== undefined) {
      update['currentStatus.activeIncidentId'] = extra.activeIncidentId ?? FieldValue.delete()
    }
    if (extra.lastCheckAt) {
      update['currentStatus.lastCheckAt'] = FieldValue.serverTimestamp()
    }
    await db.collection(COLLECTION).doc(id).update(update)
  },

  async archive(id: string, actorUid?: string): Promise<void> {
    await col()
      .doc(id)
      .update({ status: 'archived', updatedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'services.archive',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async delete(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).delete()

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'services.delete',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async addMonitorId(serviceId: string, monitorId: string): Promise<void> {
    await getAdminDb()
      .collection(COLLECTION)
      .doc(serviceId)
      .update({
        monitorIds: FieldValue.arrayUnion(monitorId),
        updatedAt: FieldValue.serverTimestamp(),
      })
  },

  async getDailyRollups(
    serviceId: string,
    fromDate: string,
    toDate: string,
  ): Promise<Array<{ date: string; uptimePct: number; downtimeSec: number }>> {
    const snap = await getAdminDb()
      .collection(COLLECTION)
      .doc(serviceId)
      .collection('daily')
      .where('date', '>=', fromDate)
      .where('date', '<=', toDate)
      .orderBy('date', 'asc')
      .get()
    return snap.docs.map((d) => d.data() as { date: string; uptimePct: number; downtimeSec: number })
  },
}
