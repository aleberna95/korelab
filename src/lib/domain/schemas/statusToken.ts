import { z } from 'zod'

export const StatusTokenSectionSchema = z.enum([
  'status',
  'incidents',
  'reports',
  'maintenance',
])

export const CreateStatusTokenSchema = z.object({
  scope: z.enum(['client', 'service']),
  targetId: z.string().min(1),
  /** ISO datetime string — repo converts to Firestore Timestamp */
  expiresAt: z.string().datetime().optional(),
  allowedSections: z.array(StatusTokenSectionSchema).min(1),
})

export const UpdateStatusTokenSchema = z.object({
  /** ISO datetime string */
  revokedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  allowedSections: z.array(StatusTokenSectionSchema).optional(),
})

export type CreateStatusTokenInput = z.infer<typeof CreateStatusTokenSchema>
export type UpdateStatusTokenInput = z.infer<typeof UpdateStatusTokenSchema>
