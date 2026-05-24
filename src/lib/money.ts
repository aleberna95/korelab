/**
 * Money helpers.
 * All monetary values in the app are stored as integers in cents (no floats).
 */

/** Convert a euro float to integer cents. */
export const toCents = (eur: number): number => Math.round(eur * 100)

/** Convert integer cents to a euro float. */
export const fromCents = (cents: number): number => cents / 100

/** Format integer cents as a localized euro string (e.g. "€ 1.234,56"). */
export const formatEUR = (cents: number): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    fromCents(cents),
  )

/** Format integer cents as a compact euro string without decimals (e.g. "€ 1.234"). */
export const formatEURCompact = (cents: number): string =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(fromCents(cents))
