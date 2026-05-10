import { z } from 'zod'

export const ResourceKindSchema = z.enum([
  'docker-host',
  'k8s-cluster',
  'db',
  'dns-zone',
  'ssl-cert',
  'domain',
  'repo',
  'firebase-project',
  'vps',
  'other',
])

export const CreateResourceSchema = z.object({
  kind: ResourceKindSchema,
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().optional(),
  /** Kind-specific data. No secrets allowed here. */
  metadata: z.record(z.unknown()).default({}),
  /** Pointers to secretsRefs docs — NEVER actual secret values */
  secretRefIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
})

export const UpdateResourceSchema = CreateResourceSchema.partial()

export type CreateResourceInput = z.infer<typeof CreateResourceSchema>
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>
