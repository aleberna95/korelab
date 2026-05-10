import { z } from 'zod'

export const CreateMaintenanceWindowSchema = z.object({
  serviceIds: z.array(z.string()).min(1, 'At least one service required'),
  clientId: z.string().min(1),
  title: z.string().min(1),
  publicMessage: z.string().default(''),
  /** ISO 8601 datetime strings — repo converts to Firestore Timestamp */
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  suppressIncidents: z.boolean().default(true),
})

export const UpdateMaintenanceWindowSchema = CreateMaintenanceWindowSchema.partial()

export type CreateMaintenanceWindowInput = z.infer<typeof CreateMaintenanceWindowSchema>
export type UpdateMaintenanceWindowInput = z.infer<typeof UpdateMaintenanceWindowSchema>
