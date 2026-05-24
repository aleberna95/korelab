import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ─── Mark installment as paid ────────────────────────────────────────────────

export const MarkInstallmentPaidSchema = z.object({
  paymentId: z.string().min(1),
  installmentId: z.string().min(1),
  paidDate: z.string().regex(DATE_REGEX, 'Formato data non valido (YYYY-MM-DD)'),
  paidMethod: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
})

export type MarkInstallmentPaidInput = z.infer<typeof MarkInstallmentPaidSchema>
