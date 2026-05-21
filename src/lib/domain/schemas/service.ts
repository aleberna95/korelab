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

export const ServiceCheckSchema = z.object({
  enabled: z.boolean().default(true),
  url: z.string().url(),
  intervalSec: z.number().int().min(60).default(300),
  timeoutMs: z.number().int().min(1000).default(10000),
  expectStatus: z.number().int().min(100).max(599).optional(),
  expectBody: z.string().optional(),
  sslCheck: z.boolean().default(false),
  sslAlertDays: z.array(z.number().int()).default([30, 14, 7, 1]),
  alertedThresholds: z.array(z.number().int()).default([]),
})

export const CreateServiceSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  type: ServiceTypeSchema,
  environment: z.enum(['production', 'staging', 'dev']),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()).default([]),
  description: z.string().default(''),
  url: z.string().url().optional(),
  check: ServiceCheckSchema.optional(),
  /** currentStatus.since and activeIncidentId are set by the server */
  currentStatus: z.object({
    state: ServiceStatusStateSchema.default('unknown'),
    activeIncidentId: z.string().optional(),
    uptime30d: z.number().min(0).max(100).optional(),
  }),
})

export const UpdateServiceSchema = CreateServiceSchema.partial()

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>
