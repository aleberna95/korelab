import { z } from 'zod'

export const ServiceTypeSchema = z.enum([
  'static-site',
  'landing',
  'corporate-site',
  'ecommerce',
  'saas',
  'api',
  'mobile-backend',
  'firebase-project',
  'domain',
  'other',
])

export const ServiceStatusStateSchema = z.enum([
  'operational',
  'degraded',
  'partial-outage',
  'major-outage',
  'maintenance',
  'unknown',
])

export const CreateServiceSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  type: ServiceTypeSchema,
  environment: z.enum(['production', 'staging', 'dev']),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()).default([]),
  description: z.string().default(''),
  url: z.string().url().optional(),
  healthcheckUrl: z.string().url().optional(),
  statusPageVisibility: z.enum(['private', 'tokenized', 'public']).default('private'),
  /** currentStatus.since and activeIncidentId are set by the server */
  currentStatus: z.object({
    state: ServiceStatusStateSchema.default('unknown'),
    activeIncidentId: z.string().optional(),
    uptime30d: z.number().min(0).max(100).optional(),
  }),
  monitorIds: z.array(z.string()).default([]),
})

export const UpdateServiceSchema = CreateServiceSchema.partial()

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>
