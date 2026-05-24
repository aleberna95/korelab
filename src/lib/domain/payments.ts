// ─── Payment domain types ────────────────────────────────────────────────────

// NB: 'overdue' NON è uno status persistito.
// È derivato client-side: overdue = status === 'pending' && expectedDate < today
export type InstallmentStatus = 'pending' | 'paid' | 'cancelled'

export interface PaymentInstallment {
  id: string                   // "0" per acconto, "1"…"N" per rate
  index: number                // 0 = acconto, 1..N rate
  label: string                // "Acconto", "Rata 1 di 6"
  expectedDate: string         // YYYY-MM-DD
  amountCents: number
  status: InstallmentStatus
  paidDate?: string            // YYYY-MM-DD
  paidMethod?: string          // libero: "bonifico", "contanti", …
  note?: string
}

export interface Payment {
  id: string
  number: string               // "PAG-2026-001"
  quoteId: string
  quoteNumber: string          // denormalizzato per lista UI
  clientId: string
  clientSnapshot: { name: string }
  totalCents: number           // = quote.totals.totalCents
  installments: PaymentInstallment[]
  status: 'open' | 'completed' | 'cancelled'
  createdAt: string            // ISO string
  updatedAt: string
  completedAt?: string
}
