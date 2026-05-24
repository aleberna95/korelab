import { describe, it, expect } from 'vitest'
import { computeQuoteTotals } from '@/lib/quotes/totals'

const line = (unitPriceCents: number, qty = 1) => ({
  id: '1',
  description: 'Test',
  qty,
  unitPriceCents,
})

const pct = (value: number, label = 'Sconto') => ({
  id: crypto.randomUUID(),
  label,
  kind: 'percent' as const,
  value,
})

const fixed = (value: number, label = 'Sconto') => ({
  id: crypto.randomUUID(),
  label,
  kind: 'fixed' as const,
  value,
})

describe('computeQuoteTotals', () => {
  it('1 riga 100€, IVA 22% → total 122€', () => {
    const r = computeQuoteTotals({ lines: [line(10000)], discounts: [], vatPercent: 22 })
    expect(r.subtotalCents).toBe(10000)
    expect(r.discountTotalCents).toBe(0)
    expect(r.taxableCents).toBe(10000)
    expect(r.vatCents).toBe(2200)
    expect(r.totalCents).toBe(12200)
  })

  it('1 riga 100€, sconto 10% + IVA 22%', () => {
    const r = computeQuoteTotals({
      lines: [line(10000)],
      discounts: [pct(10)],
      vatPercent: 22,
    })
    expect(r.subtotalCents).toBe(10000)
    expect(r.discountTotalCents).toBe(1000)
    expect(r.taxableCents).toBe(9000)
    expect(r.vatCents).toBe(1980)
    expect(r.totalCents).toBe(10980)
  })

  it('2 sconti progressivi: 10% poi 500 centesimi fissi', () => {
    // running: 10000 → -1000 → 9000 → -500 → 8500
    const r = computeQuoteTotals({
      lines: [line(10000)],
      discounts: [pct(10, 'Sconto 10%'), fixed(500, 'Sconto fisso')],
      vatPercent: 0,
    })
    expect(r.subtotalCents).toBe(10000)
    expect(r.discountTotalCents).toBe(1500)
    expect(r.taxableCents).toBe(8500)
    expect(r.vatCents).toBe(0)
    expect(r.totalCents).toBe(8500)
  })

  it('sconto fixed > subtotal → clamp a subtotal, totale a zero', () => {
    const r = computeQuoteTotals({
      lines: [line(5000)],
      discounts: [fixed(10000)],
      vatPercent: 22,
    })
    expect(r.discountTotalCents).toBe(5000)
    expect(r.taxableCents).toBe(0)
    expect(r.vatCents).toBe(0)
    expect(r.totalCents).toBe(0)
  })

  it('qty > 1 moltiplica correttamente', () => {
    const r = computeQuoteTotals({ lines: [line(5000, 3)], discounts: [], vatPercent: 0 })
    expect(r.subtotalCents).toBe(15000)
  })

  it('più righe sommano correttamente', () => {
    const r = computeQuoteTotals({
      lines: [line(10000), line(5000, 2)],
      discounts: [],
      vatPercent: 5,
    })
    expect(r.subtotalCents).toBe(20000)
    expect(r.vatCents).toBe(1000)
    expect(r.totalCents).toBe(21000)
  })

  it('righe vuote → tutto a zero', () => {
    const r = computeQuoteTotals({ lines: [], discounts: [], vatPercent: 22 })
    expect(r.subtotalCents).toBe(0)
    expect(r.totalCents).toBe(0)
  })

  it('IVA arrotondata al centesimo', () => {
    // 100€ * 5% = 5.00€ esatto
    // 100.01€ * 5% = 5.0005 → arrotondato a 5 (Math.round)
    const r = computeQuoteTotals({ lines: [line(10001)], discounts: [], vatPercent: 5 })
    expect(r.vatCents).toBe(500) // Math.round(10001 * 0.05) = Math.round(500.05) = 500
  })

  it('sconto % applicato sulla running balance (ordine importa)', () => {
    // Sconto 50% poi 50%: 10000 → 5000 → 2500 (totale sconto 7500)
    // Sconto 100% in una volta: totale sconto 10000
    const r = computeQuoteTotals({
      lines: [line(10000)],
      discounts: [pct(50), pct(50)],
      vatPercent: 0,
    })
    expect(r.discountTotalCents).toBe(7500)
    expect(r.taxableCents).toBe(2500)
  })
})
