import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'

/**
 * Returns the next quote number for the given year.
 * Uses a Firestore transaction on counters/{year}.quoteSeq to guarantee uniqueness.
 *
 * Format: PREV-{year}-{seq padded to 3 digits}
 * e.g.   PREV-2026-001
 */
export async function nextQuoteNumber(year: number): Promise<string> {
  const seq = await incrementCounter(year, 'quoteSeq')
  return `PREV-${year}-${String(seq).padStart(3, '0')}`
}

/**
 * Returns the next payment number for the given year.
 * Format: PAG-{year}-{seq padded to 3 digits}
 * e.g.   PAG-2026-001
 */
export async function nextPaymentNumber(year: number): Promise<string> {
  const seq = await incrementCounter(year, 'paymentSeq')
  return `PAG-${year}-${String(seq).padStart(3, '0')}`
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function incrementCounter(
  year: number,
  field: 'quoteSeq' | 'paymentSeq',
): Promise<number> {
  const db = getAdminDb()
  const ref = db.collection('counters').doc(String(year))

  const newValue = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists ? (snap.data()![field] ?? 0) : 0
    const next = (current as number) + 1
    tx.set(ref, { [field]: next }, { merge: true })
    return next
  })

  return newValue
}
