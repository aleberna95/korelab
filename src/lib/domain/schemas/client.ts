import { z } from 'zod'

export const SupportPlanSchema = z.enum([
  'none',
  'monitor-only',
  'reporting-only',
  'managed-support',
  'managed-infra',
  'auto-healing',
])

export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().min(1),
  primary: z.boolean(),
})

export const CreateClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessType: z.enum(['agency', 'ecommerce', 'corporate', 'startup', 'other']),
  contacts: z.array(ContactSchema).min(1, 'At least one contact is required'),
  notificationPrefs: z.object({
    email: z.boolean(),
    emails: z.array(z.string().email()),
    telegramChatId: z.string().optional(),
    quietHours: z
      .object({ start: z.string(), end: z.string(), tz: z.string() })
      .optional(),
  }),
  supportPlan: SupportPlanSchema,
  /** contractRef.signedAt is a server Timestamp — not validated here */
  contractRef: z
    .object({
      docUrl: z.string().url(),
      clausesAcceptedIds: z.array(z.string()),
    })
    .optional(),
  consent: z.object({
    monitoring: z.boolean(),
    notification: z.boolean(),
    intervention: z.boolean(),
    autoHealing: z.boolean(),
  }),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
})

export const UpdateClientSchema = CreateClientSchema.partial()

export type CreateClientInput = z.infer<typeof CreateClientSchema>
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
