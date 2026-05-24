'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { quotesRepo } from '@/lib/repos/quotesRepo'
import { paymentsRepo } from '@/lib/repos/paymentsRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { nextQuoteNumber, nextPaymentNumber } from '@/lib/quotes/counter'
import { buildInstallments } from '@/lib/quotes/installments'
import { getAdminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { revalidatePath } from 'next/cache'
import { CreateQuoteDraftSchema, UpdateQuoteDraftSchema } from '@/lib/domain/schemas/quote'
import type { UpdateQuoteDraftInput } from '@/lib/domain/schemas/quote'
import type { QuoteStatus } from '@/lib/domain/quotes'
import type { PaymentInstallment } from '@/lib/domain/payments'

/**
 * Creates a new bozza quote for a given client.
 * Fetches the client snapshot, assigns the next sequential number, and writes the doc.
 */
export async function createQuoteDraft(clientId: string): Promise<{ id: string }> {
  await requireAdmin()

  const { clientId: validatedClientId } = CreateQuoteDraftSchema.parse({ clientId })

  const client = await clientsRepo.getById(validatedClientId)
  if (!client) throw new Error('Cliente non trovato')

  const year = new Date().getFullYear()
  const number = await nextQuoteNumber(year)

  const quote = await quotesRepo.create({
    clientId: validatedClientId,
    clientSnapshot: {
      name: client.name,
      ...(client.email && { email: client.email }),
      ...(client.phone && { phone: client.phone }),
      ...(client.vatNumber && { vatNumber: client.vatNumber }),
      ...(client.taxCode && { taxCode: client.taxCode }),
      ...(client.address && { address: client.address }),
      ...(client.pec && { pec: client.pec }),
      ...(client.sdi && { sdi: client.sdi }),
    },
    number,
  })

  revalidatePath('/admin/quotes')
  return { id: quote.id }
}

/**
 * Updates a bozza quote's editable fields.
 * Totals are recomputed server-side on every call.
 * Throws if the quote is not in 'bozza' status.
 */
export async function updateQuoteDraft(id: string, patch: UpdateQuoteDraftInput): Promise<void> {
  await requireAdmin()

  const validated = UpdateQuoteDraftSchema.parse(patch)
  await quotesRepo.updateDraft(id, validated)

  revalidatePath(`/admin/quotes/${id}`)
}

/**
 * Advances a bozza quote to 'in-approvazione'.
 * No other status transition is allowed from the client.
 * (approveQuote is a separate action in S14.)
 */
export async function setQuoteStatus(
  id: string,
  status: Extract<QuoteStatus, 'in-approvazione' | 'rifiutato'>,
): Promise<void> {
  await requireAdmin()

  // Validate allowed transitions from client-side actions
  if (status !== 'in-approvazione' && status !== 'rifiutato') {
    throw new Error('Transizione di stato non consentita')
  }

  await quotesRepo.setStatus(id, status)

  revalidatePath(`/admin/quotes/${id}`)
  revalidatePath('/admin/quotes')
}

/**
 * Reverts a quote from 'in-approvazione' back to 'bozza'.
 */
export async function revertQuoteToDraft(id: string): Promise<void> {
  await requireAdmin()

  const quote = await quotesRepo.getById(id)
  if (!quote) throw new Error('Preventivo non trovato')
  if (quote.status !== 'in-approvazione') {
    throw new Error('Solo i preventivi in approvazione possono essere riportati in bozza')
  }

  await quotesRepo.setStatus(id, 'bozza')

  revalidatePath(`/admin/quotes/${id}`)
  revalidatePath('/admin/quotes')
}

/**
 * Deletes a bozza quote permanently.
 * Throws if the quote is not in 'bozza' status.
 */
export async function deleteQuote(id: string): Promise<void> {
  await requireAdmin()

  await quotesRepo.delete(id)

  revalidatePath('/admin/quotes')
}

/**
 * Refreshes the clientSnapshot of a bozza quote with current client data.
 * Throws if the quote is not in 'bozza' status.
 */
export async function refreshQuoteClientSnapshot(id: string): Promise<void> {
  await requireAdmin()

  const quote = await quotesRepo.getById(id)
  if (!quote) throw new Error('Preventivo non trovato')
  if (quote.status !== 'bozza') throw new Error('Solo le bozze possono essere aggiornate')

  const client = await clientsRepo.getById(quote.clientId)
  if (!client) throw new Error('Cliente non trovato')

  const db = getAdminDb()
  await db.collection('quotes').doc(id).update({
    clientSnapshot: {
      name: client.name,
      ...(client.email && { email: client.email }),
      ...(client.phone && { phone: client.phone }),
      ...(client.vatNumber && { vatNumber: client.vatNumber }),
      ...(client.taxCode && { taxCode: client.taxCode }),
      ...(client.address && { address: client.address }),
      ...(client.pec && { pec: client.pec }),
      ...(client.sdi && { sdi: client.sdi }),
    },
    updatedAt: FieldValue.serverTimestamp(),
  })

  revalidatePath(`/admin/quotes/${id}`)
}

export interface ApproveQuoteInput {
  /** True if the client has already paid the acconto before approval. */
  accontoAlreadyPaid?: boolean
  /**
   * ISO date for the acconto:
   * - if accontoAlreadyPaid = true  → paidDate
   * - if accontoAlreadyPaid = false → expectedDate (defaults to today)
   */
  accontoDate?: string
  /**
   * ISO date for the first regular installment (or saldo for lump-sum).
   * Defaults to today when not provided.
   */
  firstInstallmentDate?: string
}

/**
 * Approves a quote that is in 'in-approvazione' status.
 *
 * In a single Firestore transaction:
 *   1. Re-verifies the quote status.
 *   2. Builds the installment list from the payment plan.
 *   3. Creates a payments/{paymentId} document.
 *   4. Sets quote.status = 'approvato', quote.paymentId, quote.approvedAt.
 *
 * Payment number is reserved outside the transaction (via atomic counter).
 */
export async function approveQuote(
  quoteId: string,
  input: ApproveQuoteInput,
): Promise<{ paymentId: string }> {
  await requireAdmin()

  // ── Load & pre-validate quote ─────────────────────────────────────────────
  const quote = await quotesRepo.getById(quoteId)
  if (!quote) throw new Error('Preventivo non trovato')
  if (quote.status !== 'in-approvazione') {
    throw new Error('Solo i preventivi in approvazione possono essere approvati')
  }

  // ── Reserve payment number ────────────────────────────────────────────────
  const year = new Date().getFullYear()
  const paymentNumber = await nextPaymentNumber(year)
  const today = new Date().toISOString().slice(0, 10)

  // ── Build installment list ────────────────────────────────────────────────
  const paymentDate = input.firstInstallmentDate ?? today
  const accontoCents = quote.payment.acconto?.amountCents ?? 0
  const netCents = quote.totals.totalCents - accontoCents
  const installments: PaymentInstallment[] = []

  // Rata 0 — acconto (if any)
  if (quote.payment.acconto) {
    const paid = input.accontoAlreadyPaid ?? false
    const accontoDate = input.accontoDate ?? today
    installments.push({
      id: '0',
      index: 0,
      label: 'Acconto',
      expectedDate: paid ? accontoDate : (quote.payment.acconto.expectedDate ?? accontoDate),
      amountCents: quote.payment.acconto.amountCents,
      status: paid ? 'paid' : 'pending',
      ...(paid && { paidDate: accontoDate }),
    })
  }

  // Rate 1..N (or single saldo)
  if (quote.payment.mode === 'installments' && quote.payment.installments) {
    const { count, cadence, custom } = quote.payment.installments
    const rates = buildInstallments({ totalCents: netCents, count, cadence, custom, startDate: paymentDate })
    installments.push(...rates)
  } else {
    // Lump-sum — single saldo installment
    installments.push({
      id: String(installments.length + 1),
      index: installments.length + 1,
      label: accontoCents > 0 ? 'Saldo' : 'Pagamento',
      expectedDate: paymentDate,
      amountCents: netCents,
      status: 'pending',
    })
  }

  // ── Firestore transaction ─────────────────────────────────────────────────
  const db = getAdminDb()
  const quoteRef = db.collection('quotes').doc(quoteId)
  const paymentRef = paymentsRepo.newRef()
  const paymentId = paymentRef.id

  await db.runTransaction(async (tx) => {
    // Re-verify status hasn't changed
    const snap = await tx.get(quoteRef)
    if (!snap.exists || snap.data()!.status !== 'in-approvazione') {
      throw new Error('Il preventivo non è più in approvazione')
    }

    const now = FieldValue.serverTimestamp()
    const allPaid = installments.every((i) => i.status === 'paid')

    tx.set(paymentRef, {
      id: paymentId,
      number: paymentNumber,
      quoteId,
      quoteNumber: quote.number,
      clientId: quote.clientId,
      clientSnapshot: { name: quote.clientSnapshot.name },
      totalCents: quote.totals.totalCents,
      installments,
      status: allPaid ? 'completed' : 'open',
      createdAt: now,
      updatedAt: now,
    })

    tx.update(quoteRef, {
      status: 'approvato',
      paymentId,
      approvedAt: now,
      updatedAt: now,
    })
  })

  revalidatePath(`/admin/quotes/${quoteId}`)
  revalidatePath('/admin/quotes')
  revalidatePath('/admin/payments')

  return { paymentId }
}

/**
 * Duplicates any quote (any status) into a new bozza,
 * preserving lines, discounts, payment plan, notes and vatPercent.
 */
export async function duplicateQuote(quoteId: string): Promise<{ id: string }> {
  await requireAdmin()

  const source = await quotesRepo.getById(quoteId)
  if (!source) throw new Error('Preventivo non trovato')

  const year = new Date().getFullYear()
  const number = await nextQuoteNumber(year)

  const { id } = await quotesRepo.create({
    clientId: source.clientId,
    clientSnapshot: source.clientSnapshot,
    number,
  })

  await quotesRepo.updateDraft(id, {
    lines: source.lines,
    discounts: source.discounts,
    vatPercent: source.vatPercent,
    payment: source.payment,
    ...(source.notes && { notes: source.notes }),
  })

  revalidatePath('/admin/quotes')
  return { id }
}
