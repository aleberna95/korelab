import { describe, it, expect } from 'vitest'
import { buildInstallments } from '@/lib/quotes/installments'

describe('buildInstallments', () => {
  // ─── Importi ────────────────────────────────────────────────────────────────

  it('3 rate mensili da 100000 cents → 33333 + 33333 + 33334', () => {
    const rates = buildInstallments({
      totalCents: 100000,
      count: 3,
      cadence: 'monthly',
      startDate: '2026-07-01',
    })
    expect(rates).toHaveLength(3)
    expect(rates[0].amountCents).toBe(33333)
    expect(rates[1].amountCents).toBe(33333)
    expect(rates[2].amountCents).toBe(33334) // ultima assorbe il resto
  })

  it('somma rate === totalCents (divisione senza remainder)', () => {
    const rates = buildInstallments({
      totalCents: 80000,
      count: 4,
      cadence: 'monthly',
      startDate: '2026-07-01',
    })
    expect(rates).toHaveLength(4)
    rates.forEach((r) => expect(r.amountCents).toBe(20000))
    const sum = rates.reduce((s, r) => s + r.amountCents, 0)
    expect(sum).toBe(80000)
  })

  it('somma rate === totalCents (con remainder)', () => {
    const rates = buildInstallments({
      totalCents: 100001,
      count: 3,
      cadence: 'monthly',
      startDate: '2026-07-01',
    })
    const sum = rates.reduce((s, r) => s + r.amountCents, 0)
    expect(sum).toBe(100001)
  })

  it('totalCents già nettato acconto: 1000€ - 200€ acconto, 4 rate mensili', () => {
    // Il chiamante passa 80000 (1000€ - 200€), la funzione non conosce l'acconto
    const rates = buildInstallments({
      totalCents: 80000,
      count: 4,
      cadence: 'monthly',
      startDate: '2026-07-01',
    })
    expect(rates).toHaveLength(4)
    rates.forEach((r) => expect(r.amountCents).toBe(20000))
  })

  it('unica rata → label "Saldo"', () => {
    const rates = buildInstallments({
      totalCents: 50000,
      count: 1,
      cadence: 'monthly',
      startDate: '2026-06-01',
    })
    expect(rates).toHaveLength(1)
    expect(rates[0].amountCents).toBe(50000)
    expect(rates[0].label).toBe('Saldo')
    expect(rates[0].index).toBe(1)
  })

  // ─── Indici e label ──────────────────────────────────────────────────────────

  it('indici e label corretti', () => {
    const rates = buildInstallments({
      totalCents: 20000,
      count: 2,
      cadence: 'monthly',
      startDate: '2026-06-01',
    })
    expect(rates[0].index).toBe(1)
    expect(rates[0].label).toBe('Rata 1 di 2')
    expect(rates[1].index).toBe(2)
    expect(rates[1].label).toBe('Rata 2 di 2')
    rates.forEach((r) => expect(r.status).toBe('pending'))
  })

  it("id è la stringa dell'indice", () => {
    const rates = buildInstallments({
      totalCents: 30000,
      count: 3,
      cadence: 'monthly',
      startDate: '2026-06-01',
    })
    expect(rates[0].id).toBe('1')
    expect(rates[1].id).toBe('2')
    expect(rates[2].id).toBe('3')
  })

  // ─── Date — mensile ──────────────────────────────────────────────────────────

  it('cadenza mensile: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 30000,
      count: 3,
      cadence: 'monthly',
      startDate: '2026-06-01',
    })
    expect(rates[0].expectedDate).toBe('2026-06-01')
    expect(rates[1].expectedDate).toBe('2026-07-01')
    expect(rates[2].expectedDate).toBe('2026-08-01')
  })

  // ─── Date — settimanale ──────────────────────────────────────────────────────

  it('cadenza settimanale: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 20000,
      count: 2,
      cadence: 'weekly',
      startDate: '2026-06-01',
    })
    expect(rates[0].expectedDate).toBe('2026-06-01')
    expect(rates[1].expectedDate).toBe('2026-06-08')
  })

  // ─── Date — trimestrale ──────────────────────────────────────────────────────

  it('cadenza trimestrale: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 30000,
      count: 3,
      cadence: 'quarterly',
      startDate: '2026-01-01',
    })
    expect(rates[0].expectedDate).toBe('2026-01-01')
    expect(rates[1].expectedDate).toBe('2026-04-01')
    expect(rates[2].expectedDate).toBe('2026-07-01')
  })

  // ─── Date — semestrale ────────────────────────────────────────────────────────

  it('cadenza semestrale: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 20000,
      count: 2,
      cadence: 'semiannual',
      startDate: '2026-01-01',
    })
    expect(rates[0].expectedDate).toBe('2026-01-01')
    expect(rates[1].expectedDate).toBe('2026-07-01')
  })

  // ─── Date — annuale ──────────────────────────────────────────────────────────

  it('cadenza annuale: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 20000,
      count: 2,
      cadence: 'yearly',
      startDate: '2026-01-01',
    })
    expect(rates[0].expectedDate).toBe('2026-01-01')
    expect(rates[1].expectedDate).toBe('2027-01-01')
  })

  // ─── Date — custom ───────────────────────────────────────────────────────────

  it('custom ogni 2 settimane: date corrette', () => {
    const rates = buildInstallments({
      totalCents: 30000,
      count: 3,
      cadence: 'custom',
      custom: { every: 2, unit: 'week' },
      startDate: '2026-01-01',
    })
    expect(rates[0].expectedDate).toBe('2026-01-01')
    expect(rates[1].expectedDate).toBe('2026-01-15')
    expect(rates[2].expectedDate).toBe('2026-01-29')
    const sum = rates.reduce((s, r) => s + r.amountCents, 0)
    expect(sum).toBe(30000)
  })

  it('custom ogni 3 mesi: equivalente a trimestrale', () => {
    const rates = buildInstallments({
      totalCents: 30000,
      count: 3,
      cadence: 'custom',
      custom: { every: 3, unit: 'month' },
      startDate: '2026-01-01',
    })
    expect(rates[0].expectedDate).toBe('2026-01-01')
    expect(rates[1].expectedDate).toBe('2026-04-01')
    expect(rates[2].expectedDate).toBe('2026-07-01')
  })

  it('custom ogni 10 giorni', () => {
    const rates = buildInstallments({
      totalCents: 20000,
      count: 2,
      cadence: 'custom',
      custom: { every: 10, unit: 'day' },
      startDate: '2026-06-01',
    })
    expect(rates[0].expectedDate).toBe('2026-06-01')
    expect(rates[1].expectedDate).toBe('2026-06-11')
  })

  // ─── Errori ──────────────────────────────────────────────────────────────────

  it('custom senza custom config → throw', () => {
    expect(() =>
      buildInstallments({ totalCents: 10000, count: 2, cadence: 'custom', startDate: '2026-01-01' }),
    ).toThrow('custom cadence requires a custom config')
  })

  it('count < 1 → throw', () => {
    expect(() =>
      buildInstallments({ totalCents: 10000, count: 0, cadence: 'monthly', startDate: '2026-01-01' }),
    ).toThrow('count must be ≥ 1')
  })
})
