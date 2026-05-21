import { z } from 'zod'

export const IncidentStateSchema = z.enum([
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'false-positive',
])

export const IncidentSeveritySchema = z.enum(['minor', 'major', 'critical'])

export const IncidentSourceSchema = z.enum([
  'internal-check',
  'manual',
])

export const IncidentTimelineEventSchema = z.object({
  kind: z.enum(['detected', 'updated', 'comment', 'resolved', 'reopened']),
  message: z.string().min(1),
  byUid: z.string().optional(),
})

export const CreateIncidentSchema = z.object({
  serviceId: z.string().min(1),
  clientId: z.string().min(1),
  state: IncidentStateSchema.default('investigating'),
  severity: IncidentSeveritySchema,
  source: IncidentSourceSchema,
  title: z.string().min(1),
  privateMessage: z.string().optional(),
  rootCause: z.string().optional(),
  resolution: z.string().optional(),
  metrics: z.object({
    downtimeSec: z.number().int().min(0).optional(),
  }),
})

export const UpdateIncidentSchema = CreateIncidentSchema.partial()

export type IncidentTimelineEventInput = z.infer<typeof IncidentTimelineEventSchema>
export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>
