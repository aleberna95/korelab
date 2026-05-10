import { z } from 'zod'

export const SecretRefKindSchema = z.enum([
  'ssh-key',
  'api-key',
  'oauth-token',
  'service-account',
  'db-credentials',
  'other',
])

export const CreateSecretRefSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  kind: SecretRefKindSchema,
  /** Full Google Secret Manager resource name — NEVER the actual secret value */
  secretManagerRef: z
    .string()
    .regex(
      /^projects\/[^/]+\/secrets\/[^/]+\/versions\/.+$/,
      'Must be a valid Secret Manager resource name: projects/{project}/secrets/{secret}/versions/{version}',
    ),
  clientId: z.string().optional(),
  resourceId: z.string().optional(),
  description: z.string().default(''),
  /** ISO datetime string */
  lastRotatedAt: z.string().datetime().optional(),
})

export const UpdateSecretRefSchema = CreateSecretRefSchema.partial()

export type CreateSecretRefInput = z.infer<typeof CreateSecretRefSchema>
export type UpdateSecretRefInput = z.infer<typeof UpdateSecretRefSchema>
