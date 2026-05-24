'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { paymentsRepo } from '@/lib/repos/paymentsRepo'
import { getAdminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { revalidatePath } from 'next/cache'
import type { PaymentInstallment } from '@/lib/domain/payments'

function revalidate(paymentId: string) {
  revalidatePath(`/admin/payments/${paymentId}`)
  revalidatePath('/admin/payments')
}

/**
 * Marks an installment as paid. If all installments become paid,
 * the payment status is automatically set to 'completed'.
 */
export async function markInstallmentPaid(
  paymentId: string,
  installmentId: string,
  input: { paidDate: string; paidMethod?: string; note?: string },
): Promise<void> {
  await requireAdmin()

  const payment = await paymentsRepo.getById(paymentId)
  if (!payment) throw new Error('Pagamento non trovato')

  const installments: PaymentInstallment[] = payment.installments.map((inst) => {
    if (inst.id !== installmentId) return inst
    const updated: PaymentInstallment = {
      id: inst.id,
      index: inst.index,
      label: inst.label,
      expectedDate: inst.expectedDate,
      amountCents: inst.amountCents,
      status: 'paid',
      paidDate: input.paidDate,
    }
    if (input.paidMethod) updated.paidMethod = input.paidMethod
    if (input.note) updated.note = input.note
    return updated
  })

  const allPaid = installments.every((i) => i.status === 'paid')

  const update: Record<string, unknown> = {
    installments,
    status: allPaid ? 'completed' : 'open',
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (allPaid) update.completedAt = FieldValue.serverTimestamp()

  await getAdminDb().collection('payments').doc(paymentId).update(update)

  revalidate(paymentId)
}

/**
 * Reverts a paid installment back to pending.
 * Resets payment status to 'open' and removes completedAt.
 */
export async function reopenInstallment(
  paymentId: string,
  installmentId: string,
): Promise<void> {
  await requireAdmin()

  const payment = await paymentsRepo.getById(paymentId)
  if (!payment) throw new Error('Pagamento non trovato')

  // Reconstruct the installment without optional paid fields
  const installments: PaymentInstallment[] = payment.installments.map((inst) => {
    if (inst.id !== installmentId) return inst
    return {
      id: inst.id,
      index: inst.index,
      label: inst.label,
      expectedDate: inst.expectedDate,
      amountCents: inst.amountCents,
      status: 'pending',
    }
  })

  await getAdminDb()
    .collection('payments')
    .doc(paymentId)
    .update({
      installments,
      status: 'open',
      completedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })

  revalidate(paymentId)
}

/**
 * Cancels a payment (admin only, irreversible without manual intervention).
 */
export async function cancelPayment(paymentId: string): Promise<void> {
  await requireAdmin()

  const payment = await paymentsRepo.getById(paymentId)
  if (!payment) throw new Error('Pagamento non trovato')
  if (payment.status === 'cancelled') return

  await getAdminDb().collection('payments').doc(paymentId).update({
    status: 'cancelled',
    updatedAt: FieldValue.serverTimestamp(),
  })

  revalidate(paymentId)
}
