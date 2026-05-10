import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import { CreateAuditLogSchema, type CreateAuditLogInput } from '@/lib/domain/schemas/auditLog'
import type { AuditLog } from '@/lib/domain/types'

const COLLECTION = 'auditLog'
const converter = makeDocConverter<AuditLog>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type AuditLogFilters = {
  action?: string
  actorKind?: AuditLog['actorKind']
  targetCollection?: string
  limit?: number
  startAfter?: AuditLog
}

export const auditLogRepo = {
  async getById(id: string): Promise<AuditLog | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    let q = col().orderBy('at', 'desc') as FirebaseFirestore.Query<AuditLog>

    if (filters.action) q = q.where('action', '==', filters.action)
    if (filters.actorKind) q = q.where('actorKind', '==', filters.actorKind)
    if (filters.targetCollection) q = q.where('targetCollection', '==', filters.targetCollection)
    if (filters.startAfter) {
      const snap = await col().doc(filters.startAfter.id).get()
      q = q.startAfter(snap)
    }

    q = q.limit(filters.limit ?? 20)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  /**
   * Writes an audit log entry. Called only from server-side code.
   * Client SDK writes to auditLog are denied by security rules.
   */
  async write(input: CreateAuditLogInput): Promise<string> {
    const validated = CreateAuditLogSchema.parse(input)
    const ref = col().doc()
    await ref.set({
      ...validated,
      id: ref.id,
      at: FieldValue.serverTimestamp(),
    } as unknown as AuditLog)
    return ref.id
  },
}
