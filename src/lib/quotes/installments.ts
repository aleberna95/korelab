import type { PaymentInstallment, InstallmentStatus } from '@/lib/domain/payments'
import type { InstallmentCadence, CadenceUnit } from '@/lib/domain/quotes'

/**
 * Pure function — no I/O.
 *
 * Builds installment records for rates 1..N (does NOT include rata 0 / acconto).
 * The acconto must be constructed separately by the caller (see approveQuote action).
 *
 * @param totalCents  Total already net of acconto. Pass quote.totals.totalCents if no acconto.
 * @param count       Number of rates (≥ 1).
 * @param cadence     Payment cadence.
 * @param custom      Required when cadence === 'custom'.
 * @param startDate   YYYY-MM-DD — date of the first installment (from user input in ApproveDialog).
 *
 * Amount distribution:
 *   base = floor(totalCents / count)
 *   Last installment absorbs the remainder so sum === totalCents exactly.
 */
export function buildInstallments(args: {
  totalCents: number
  count: number
  cadence: InstallmentCadence
  custom?: { every: number; unit: CadenceUnit }
  startDate: string
}): PaymentInstallment[] {
  const { totalCents, count, cadence, custom, startDate } = args

  if (count < 1) throw new Error('count must be ≥ 1')
  if (cadence === 'custom' && !custom) {
    throw new Error('custom cadence requires a custom config')
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count

  const result: PaymentInstallment[] = []
  let currentDate = parseDate(startDate)

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1
    const amountCents = isLast ? base + remainder : base

    result.push({
      id: String(i + 1),
      index: i + 1,
      label: count === 1 ? 'Saldo' : `Rata ${i + 1} di ${count}`,
      expectedDate: formatDate(currentDate),
      amountCents,
      status: 'pending' as InstallmentStatus,
    })

    if (!isLast) {
      currentDate = advanceDate(currentDate, cadence, custom)
    }
  }

  return result
}

// ─── Date helpers (UTC to avoid timezone drift) ──────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function advanceDate(
  from: Date,
  cadence: InstallmentCadence,
  custom?: { every: number; unit: CadenceUnit },
): Date {
  const d = new Date(from)
  switch (cadence) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7)
      break
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1)
      break
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3)
      break
    case 'semiannual':
      d.setUTCMonth(d.getUTCMonth() + 6)
      break
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1)
      break
    case 'custom': {
      // custom is guaranteed non-null here (checked at top of buildInstallments)
      const { every, unit } = custom!
      switch (unit) {
        case 'day':
          d.setUTCDate(d.getUTCDate() + every)
          break
        case 'week':
          d.setUTCDate(d.getUTCDate() + every * 7)
          break
        case 'month':
          d.setUTCMonth(d.getUTCMonth() + every)
          break
        case 'year':
          d.setUTCFullYear(d.getUTCFullYear() + every)
          break
      }
      break
    }
  }
  return d
}
