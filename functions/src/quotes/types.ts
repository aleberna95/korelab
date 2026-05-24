/** Local quote/payment types mirrored from src/lib/domain for use in Cloud Functions. */

export type QuoteStatus = 'bozza' | 'in-approvazione' | 'approvato' | 'rifiutato'

export interface QuoteLine {
  id: string
  description: string
  qty: number
  unitPriceCents: number
}

export interface QuoteDiscount {
  id: string
  label: string
  kind: 'percent' | 'fixed'
  value: number // percent 0-100 or fixed cents
}

export interface PaymentPlanInstallments {
  count: number
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'custom'
  custom?: { every: number; unit: 'day' | 'week' | 'month' | 'year' }
  firstInstallmentDate?: string // ISO date
}

export interface PaymentPlanAcconto {
  amountCents: number
  expectedDate?: string // ISO date
  paidDate?: string // ISO date
}

export interface PaymentPlan {
  mode: 'lump-sum' | 'installments'
  installments?: PaymentPlanInstallments
  acconto?: PaymentPlanAcconto
}

export interface QuoteTotals {
  subtotalCents: number
  discountTotalCents: number
  taxableCents: number
  vatCents: number
  totalCents: number
}

export interface QuoteData {
  id: string
  number: string
  clientId: string
  clientSnapshot: {
    name: string
    email?: string
    phone?: string
    vatNumber?: string
    taxCode?: string
    address?: string
    pec?: string
    sdi?: string
  }
  status: QuoteStatus
  lines: QuoteLine[]
  discounts: QuoteDiscount[]
  vatPercent: number
  payment: PaymentPlan
  notes?: string
  totals: QuoteTotals
  pdfUrl?: string
  createdAt: { toDate(): Date } | string
}

export interface CompanyAddress {
  street?: string
  zip?: string
  city?: string
  country?: string
}

export interface CompanyFooterIcon {
  kind: 'website' | 'email' | 'phone' | 'instagram' | 'linkedin' | 'custom'
  label: string
  value: string
}

export interface CompanyData {
  legalName?: string
  vatNumber?: string
  taxCode?: string
  address?: CompanyAddress
  email?: string
  phone?: string
  iban?: string
  pec?: string
  sdi?: string
  logoUrl?: string
  footerIcons?: CompanyFooterIcon[]
  defaultVatPercent?: number
  pdfAccentHex?: string
  footerNote?: string
}
