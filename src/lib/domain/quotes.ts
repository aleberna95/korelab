// ─── Quote domain types ─────────────────────────────────────────────────────

export type QuoteStatus = 'bozza' | 'in-approvazione' | 'approvato' | 'rifiutato'

export type DiscountKind = 'percent' | 'fixed'

export interface QuoteLine {
  id: string
  description: string
  qty: number
  unitPriceCents: number  // e.g. 150000 = €1500.00
}

export interface QuoteDiscount {
  id: string
  label: string
  kind: DiscountKind
  value: number  // percent: 0–100; fixed: cents
}

export type CadenceUnit = 'day' | 'week' | 'month' | 'year'

export type InstallmentCadence =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'custom'

export interface PaymentPlan {
  mode: 'lump-sum' | 'installments'
  installments?: {
    count: number                   // numero rate (escluso acconto)
    cadence: InstallmentCadence
    custom?: { every: number; unit: CadenceUnit }
    firstInstallmentDate?: string   // YYYY-MM-DD, compilato in approvazione
  }
  acconto?: {
    amountCents: number
    expectedDate?: string           // YYYY-MM-DD, impostato in bozza
    paidDate?: string               // YYYY-MM-DD, impostato in approvazione se già pagato
  }
}

export interface QuoteTotals {
  subtotalCents: number
  discountTotalCents: number
  taxableCents: number              // subtotal - sconti
  vatCents: number
  totalCents: number                // taxable + vat
}

export interface Quote {
  id: string
  number: string                    // "PREV-2026-001"
  clientId: string
  clientSnapshot: {                 // freeze al momento di creazione
    name: string
    email?: string
    phone?: string
    vatNumber?: string              // P.IVA cliente
    taxCode?: string               // CF cliente
    address?: string               // indirizzo sede legale
    pec?: string
    sdi?: string
  }
  status: QuoteStatus
  lines: QuoteLine[]
  discounts: QuoteDiscount[]        // applicati in ordine progressivo
  vatPercent: number                // 5, 10, 22…
  payment: PaymentPlan
  notes?: string
  totals: QuoteTotals               // ricalcolati server-side a ogni save
  pdfUrl?: string                   // popolato dopo generazione PDF
  paymentId?: string                // popolato dopo approvazione
  createdAt: string                 // ISO string
  updatedAt: string
  approvedAt?: string
  rejectedAt?: string
}
