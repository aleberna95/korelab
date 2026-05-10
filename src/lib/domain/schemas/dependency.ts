import { z } from 'zod'

export const DependencyTypeSchema = z.enum([
  'depends-on',
  'deploys-to',
  'uses',
  'routes-to',
])

export const DependencyNodeKindSchema = z.enum(['service', 'resource'])

export const CreateDependencySchema = z.object({
  fromId: z.string().min(1),
  fromKind: DependencyNodeKindSchema,
  toId: z.string().min(1),
  toKind: DependencyNodeKindSchema,
  type: DependencyTypeSchema,
})

export type CreateDependencyInput = z.infer<typeof CreateDependencySchema>
