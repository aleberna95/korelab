import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import type { Payment } from '@/lib/domain/payments'

const COLLECTION = 'payments'
const converter = makeDocConverter<Payment>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type PaymentFilters = {
  clientId?: string
  status?: Payment['status']
  limit?: number
}

export const paymentsRepo = {
  async getById(id: string): Promise<Payment | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: PaymentFilters = {}): Promise<Payment[]> {
    let q = col().orderBy('createdAt', 'desc') as FirebaseFirestore.Query<Payment>

    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    if (filters.status) q = q.where('status', '==', filters.status)
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  /** Called inside the approveQuote transaction via raw Firestore ref. */
  newRef() {
    return getAdminDb().collection(COLLECTION).doc()
  },
}
