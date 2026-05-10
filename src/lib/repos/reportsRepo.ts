import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateReportSchema,
  UpdateReportSchema,
  type CreateReportInput,
  type UpdateReportInput,
} from '@/lib/domain/schemas/report'
import type { Report } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'reports'
const converter = makeDocConverter<Report>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type ReportFilters = {
  serviceId?: string
  clientId?: string
  periodKind?: Report['period']['kind']
  visibility?: Report['visibility']
  limit?: number
}

export const reportsRepo = {
  async getById(id: string): Promise<Report | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: ReportFilters = {}): Promise<Report[]> {
    let q = col().orderBy('generatedAt', 'desc') as FirebaseFirestore.Query<Report>

    if (filters.serviceId) q = q.where('serviceId', '==', filters.serviceId)
    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.periodKind) q = q.where('period.kind', '==', filters.periodKind)
    if (filters.visibility) q = q.where('visibility', '==', filters.visibility)
    q = q.limit(filters.limit ?? 24)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  /** Create a full report (called by scheduled function or manually) */
  async create(input: CreateReportInput, actorUid?: string): Promise<Report> {
    const validated = CreateReportSchema.parse(input)
    const ref = col().doc()

    await ref.set({
      ...validated,
      id: ref.id,
      period: {
        ...validated.period,
        from: new Date(validated.period.from),
        to: new Date(validated.period.to),
      },
      generatedAt: FieldValue.serverTimestamp(),
      generatedBy: actorUid ? 'manual' : 'auto',
      generatedByUid: actorUid,
    } as unknown as Report)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'reports.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return created.data()!
  },

  /** Update only allows changing notes and visibility */
  async update(id: string, patch: UpdateReportInput, actorUid?: string): Promise<void> {
    const validated = UpdateReportSchema.parse(patch)
    await col().doc(id).update(validated)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'reports.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
