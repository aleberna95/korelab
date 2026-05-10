import { z } from 'zod'

export const ServiceTypeSchema = z.enum([
  'static-site',
  'landing',
  'corporate-site',
  'ecommerce',
  'saas',
  'api',
  'mobile-backend',
  'database',
  'docker-service',
  'k8s-deployment',
  'cron',
  'worker',
  'firebase-project',
  'external-saas',
  'domain',
  'email',
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
  urls: z.object({
    primary: z.string().url().optional(),
    admin: z.string().url().optional(),
    healthcheck: z.string().url().optional(),
    docs: z.string().url().optional(),
  }),
  expectedHealth: z
    .object({
      statusCode: z.number().int().min(100).max(599),
      bodyContains: z.string().optional(),
    })
    .optional(),
  access: z.object({
    level: z.enum(['none', 'read-only', 'operational', 'admin']),
    providers: z.array(z.string()).default([]),
    notes: z.string().default(''),
  }),
  visibility: z.object({
    statusPage: z.enum(['private', 'tokenized', 'public']).default('private'),
    reportSharing: z.enum(['private', 'tokenized', 'email']).default('private'),
  }),
  automation: z.object({
    /** Always forced to 'disabled' in MVP — field captured for later */
    mode: z
      .enum(['disabled', 'manual-only', 'manual-approval', 'auto-low-risk'])
      .default('disabled'),
    allowedActions: z.array(z.string()).default([]),
    cooldownMinutes: z.number().int().min(0).default(30),
    maxRetries: z.number().int().min(0).default(3),
  }),
  /** currentStatus.since and activeIncidentId are set by the server */
  currentStatus: z.object({
    state: ServiceStatusStateSchema.default('unknown'),
    activeIncidentId: z.string().optional(),
    uptime30d: z.number().min(0).max(100).optional(),
  }),
  monitorIds: z.array(z.string()).default([]),
  resourceIds: z.array(z.string()).default([]),
  runbookIds: z.array(z.string()).default([]),
})

export const UpdateServiceSchema = CreateServiceSchema.partial()

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>
