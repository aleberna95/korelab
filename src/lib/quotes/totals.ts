import type { QuoteLine, QuoteDiscount, QuoteTotals } from '@/lib/domain/quotes'

/**
 * Pure function — no I/O.
 * Computes quote totals from lines, ordered discounts, and VAT %.
 *
 * Discount logic:
 * - Discounts are applied progressively in order against the running balance.
 * - 'percent': Math.round(running * value/100)
 * - 'fixed':   Math.min(value, running)  — cannot exceed running balance
 * - Last-cent rounding is on vatCents only (Math.round).
 */
export function computeQuoteTotals(input: {
  lines: QuoteLine[]
  discounts: QuoteDiscount[]
  vatPercent: number
}): QuoteTotals {
  const subtotalCents = input.lines.reduce(
    (sum, l) => sum + l.qty * l.unitPriceCents,
    0,
  )

  let running = subtotalCents
  let discountTotalCents = 0

  for (const d of input.discounts) {
    const amt =
      d.kind === 'percent'
        ? Math.round(running * (d.value / 100))
        : Math.min(d.value, running)
    discountTotalCents += amt
    running -= amt
  }

  const taxableCents = subtotalCents - discountTotalCents
  const vatCents = Math.round(taxableCents * (input.vatPercent / 100))
  const totalCents = taxableCents + vatCents

  return { subtotalCents, discountTotalCents, taxableCents, vatCents, totalCents }
}
