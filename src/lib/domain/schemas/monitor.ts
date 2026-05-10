import { z } from 'zod'

export const MonitorSourceSchema = z.enum([
  'uptimerobot',
  'internal-http',
  'internal-ssl',
  'internal-dns',
  'internal-domain',
])

export const MonitorResultSchema = z.enum(['up', 'down', 'degraded'])

export const CreateMonitorSchema = z.object({
  serviceId: z.string().min(1),
  clientId: z.string().min(1),
  source: MonitorSourceSchema,
  /** externalId is set asynchronously by the UptimeRobot sync Function */
  externalId: z.string().optional(),
  config: z.object({
    intervalSec: z.number().int().min(30).default(300),
    url: z.string().url().optional(),
    timeoutMs: z.number().int().min(1000).default(10000),
    expectStatus: z.number().int().min(100).max(599).optional(),
    expectBody: z.string().optional(),
  }),
  alertChannels: z.object({
    telegram: z.boolean().default(true),
    email: z.boolean().default(false),
    clientNotify: z.boolean().default(false),
  }),
  active: z.boolean().default(true),
})

export const UpdateMonitorSchema = CreateMonitorSchema.partial()

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorSchema>
