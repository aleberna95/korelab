import { z } from 'zod'

export const AuditActorKindSchema = z.enum(['user', 'function', 'webhook'])

export const CreateAuditLogSchema = z.object({
  actorUid: z.string().optional(),
  actorKind: AuditActorKindSchema,
  action: z.string().min(1),
  targetCollection: z.string().min(1),
  targetId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  ip: z.string().optional(),
})

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>
