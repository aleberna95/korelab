import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import { computeQuoteTotals } from '@/lib/quotes/totals'
import type { Quote, QuoteStatus, QuoteLine, QuoteDiscount, PaymentPlan } from '@/lib/domain/quotes'

const COLLECTION = 'quotes'
const converter = makeDocConverter<Quote>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type QuoteFilters = {
  status?: QuoteStatus
  clientId?: string
  limit?: number
}

export const quotesRepo = {
  async getById(id: string): Promise<Quote | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: QuoteFilters = {}): Promise<Quote[]> {
    let q = col().orderBy('createdAt', 'desc') as FirebaseFirestore.Query<Quote>

    if (filters.status) q = q.where('status', '==', filters.status)
    if (filters.clientId) q = q.where('clientId', '==', filters.clientId)
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async create(input: {
    clientId: string
    clientSnapshot: Quote['clientSnapshot']
    number: string
  }): Promise<Quote> {
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()
    const zeroed = computeQuoteTotals({ lines: [], discounts: [], vatPercent: 5 })

    await ref.set({
      id: ref.id,
      number: input.number,
      clientId: input.clientId,
      clientSnapshot: input.clientSnapshot,
      status: 'bozza',
      lines: [],
      discounts: [],
      vatPercent: 5,
      payment: { mode: 'lump-sum' },
      totals: zeroed,
      createdAt: now,
      updatedAt: now,
    } as unknown as Quote)

    const created = await ref.get()
    return created.data()!
  },

  async updateDraft(
    id: string,
    patch: {
      lines?: QuoteLine[]
      discounts?: QuoteDiscount[]
      vatPercent?: number
      payment?: PaymentPlan
      notes?: string
    },
  ): Promise<void> {
    const snap = await col().doc(id).get()
    if (!snap.exists) throw new Error('Preventivo non trovato')

    const current = snap.data()!
    if (current.status !== 'bozza') {
      throw new Error('Solo i preventivi in bozza possono essere modificati')
    }

    const lines = patch.lines ?? current.lines
    const discounts = patch.discounts ?? current.discounts
    const vatPercent = patch.vatPercent ?? current.vatPercent
    const totals = computeQuoteTotals({ lines, discounts, vatPercent })

    await col()
      .doc(id)
      .update({
        ...(patch.lines !== undefined && { lines: patch.lines }),
        ...(patch.discounts !== undefined && { discounts: patch.discounts }),
        ...(patch.vatPercent !== undefined && { vatPercent: patch.vatPercent }),
        ...(patch.payment !== undefined && { payment: patch.payment }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        totals,
        updatedAt: FieldValue.serverTimestamp(),
      })
  },

  async setStatus(id: string, status: QuoteStatus): Promise<void> {
    const snap = await col().doc(id).get()
    if (!snap.exists) throw new Error('Preventivo non trovato')

    await col()
      .doc(id)
      .update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
        ...(status === 'rifiutato' && { rejectedAt: FieldValue.serverTimestamp() }),
      })
  },

  async delete(id: string): Promise<void> {
    const snap = await col().doc(id).get()
    if (!snap.exists) throw new Error('Preventivo non trovato')

    const current = snap.data()!
    if (current.status !== 'bozza') {
      throw new Error('Solo i preventivi in bozza possono essere eliminati')
    }

    await col().doc(id).delete()
  },
}
