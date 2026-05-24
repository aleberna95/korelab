import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ─── Primitives ──────────────────────────────────────────────────────────────

export const QuoteLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, 'Descrizione obbligatoria'),
  qty: z.number().int().positive().default(1),
  unitPriceCents: z.number().int().nonnegative(),
})

export const DiscountKindSchema = z.enum(['percent', 'fixed'])

export const QuoteDiscountSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Etichetta sconto obbligatoria'),
  kind: DiscountKindSchema,
  value: z.number().nonnegative(),
})

export const CadenceUnitSchema = z.enum(['day', 'week', 'month', 'year'])

export const InstallmentCadenceSchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
  'custom',
])

export const PaymentPlanSchema = z
  .object({
    mode: z.enum(['lump-sum', 'installments']),
    installments: z
      .object({
        count: z.number().int().min(1),
        cadence: InstallmentCadenceSchema,
        custom: z
          .object({
            every: z.number().int().positive(),
            unit: CadenceUnitSchema,
          })
          .optional(),
        firstInstallmentDate: z
          .string()
          .regex(DATE_REGEX, 'Formato data non valido (YYYY-MM-DD)')
          .optional(),
      })
      .optional(),
    acconto: z
      .object({
        amountCents: z.number().int().nonnegative(),
        expectedDate: z
          .string()
          .regex(DATE_REGEX, 'Formato data non valido (YYYY-MM-DD)')
          .optional(),
        paidDate: z
          .string()
          .regex(DATE_REGEX, 'Formato data non valido (YYYY-MM-DD)')
          .optional(),
      })
      .optional(),
  })
  .refine(
    (d) => d.mode !== 'installments' || d.installments !== undefined,
    { message: 'Specificare il piano rate', path: ['installments'] },
  )
  .refine(
    (d) => {
      if (d.installments?.cadence !== 'custom') return true
      return d.installments.custom !== undefined
    },
    { message: 'Specificare la cadenza personalizzata', path: ['installments', 'custom'] },
  )

export const QuoteStatusSchema = z.enum([
  'bozza',
  'in-approvazione',
  'approvato',
  'rifiutato',
])

// ─── Input schemas (used by server actions) ──────────────────────────────────

export const CreateQuoteDraftSchema = z.object({
  clientId: z.string().min(1, 'Cliente obbligatorio'),
})

export const UpdateQuoteDraftSchema = z.object({
  lines: z.array(QuoteLineSchema).optional(),
  discounts: z.array(QuoteDiscountSchema).optional(),
  vatPercent: z.number().nonnegative().max(100).optional(),
  payment: PaymentPlanSchema.optional(),
  notes: z.string().max(5000).optional(),
})

// ─── Inferred input types ────────────────────────────────────────────────────

export type CreateQuoteDraftInput = z.infer<typeof CreateQuoteDraftSchema>
export type UpdateQuoteDraftInput = z.infer<typeof UpdateQuoteDraftSchema>
