import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateIncidentSchema,
  UpdateIncidentSchema,
  IncidentTimelineEventSchema,
  type CreateIncidentInput,
  type UpdateIncidentInput,
  type IncidentTimelineEventInput,
} from '@/lib/domain/schemas/incident'
import type { Incident, IncidentState, IncidentTimelineEvent } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'incidents'
const converter = makeDocConverter<Incident>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type IncidentFilters = {
  serviceId?: string
  clientId?: string
  state?: IncidentState
  severity?: Incident['severity']
  activeOnly?: boolean
  limit?: number
  startAfter?: Incident
}

export const incidentsRepo = {
  async getById(id: string): Promise<Incident | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: IncidentFilters = {}): Promise<Incident[]> {
    let q = col().orderBy('startedAt', 'desc') as FirebaseFirestore.Query<Incident>

    if (filters.serviceId) q = q.where('serviceId', '==', filters.serviceId)
    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.state) q = q.where('state', '==', filters.state)
    if (filters.severity) q = q.where('severity', '==', filters.severity)
    if (filters.activeOnly) {
      q = q.where('state', 'in', ['investigating', 'identified', 'monitoring'])
    }
    if (filters.startAfter) {
      const snap = await col().doc(filters.startAfter.id).get()
      q = q.startAfter(snap)
    }
    q = q.limit(filters.limit ?? 20)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async listActive(): Promise<Incident[]> {
    return this.list({ activeOnly: true, limit: 50 })
  },

  async listByService(serviceId: string, limit = 20): Promise<Incident[]> {
    return this.list({ serviceId, limit })
  },

  async listByClient(clientId: string, limit = 50): Promise<Incident[]> {
    return this.list({ clientId, limit })
  },

  async create(input: CreateIncidentInput, actorUid?: string): Promise<Incident> {
    const validated = CreateIncidentSchema.parse(input)
    const ref = col().doc()

    await ref.set({
      ...validated,
      id: ref.id,
      startedAt: FieldValue.serverTimestamp(),
    } as unknown as Incident)

    // Append initial timeline event
    await this.appendTimelineEvent(ref.id, {
      kind: 'detected',
      message: `Incident created from source: ${validated.source}`,
      byUid: actorUid,
    })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'incidents.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  async update(
    id: string,
    patch: UpdateIncidentInput,
    timelineMessage?: string,
    actorUid?: string,
  ): Promise<void> {
    const validated = UpdateIncidentSchema.parse(patch)
    const updates: Record<string, unknown> = { ...validated }

    // Set resolvedAt server-side whenever state transitions to resolved
    if (validated.state === 'resolved') {
      updates.resolvedAt = FieldValue.serverTimestamp()
    }

    await col().doc(id).update(updates)

    if (timelineMessage) {
      await this.appendTimelineEvent(id, {
        kind: 'updated',
        message: timelineMessage,
        byUid: actorUid,
      })
    }

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'incidents.update',
      targetCollection: COLLECTION,
      targetId: id,
      metadata: { fields: Object.keys(validated) },
    })
  },

  async appendTimelineEvent(
    incidentId: string,
    input: IncidentTimelineEventInput,
  ): Promise<string> {
    const validated = IncidentTimelineEventSchema.parse(input)
    const ref = getAdminDb()
      .collection(COLLECTION)
      .doc(incidentId)
      .collection('timeline')
      .doc()

    await ref.set({
      ...validated,
      id: ref.id,
      at: FieldValue.serverTimestamp(),
    })

    return ref.id
  },

  async getTimeline(incidentId: string): Promise<IncidentTimelineEvent[]> {
    const snap = await getAdminDb()
      .collection(COLLECTION)
      .doc(incidentId)
      .collection('timeline')
      .orderBy('at', 'asc')
      .get()
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as IncidentTimelineEvent)
  },

  /** Returns the active (non-resolved) incident for a service, if any */
  async getActiveForService(serviceId: string): Promise<Incident | null> {
    const snap = await col()
      .where('serviceId', '==', serviceId)
      .where('state', 'in', ['investigating', 'identified', 'monitoring'])
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get()
    return snap.empty ? null : snap.docs[0].data()
  },

  /** Returns all incidents in 'monitoring' state (for resolveStableUp job) */
  async listMonitoring(): Promise<Incident[]> {
    return this.list({ state: 'monitoring', limit: 200 })
  },
}
