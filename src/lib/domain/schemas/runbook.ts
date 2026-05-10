import { z } from 'zod'

export const RecoveryStepSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(''),
  riskLevel: z.enum(['low', 'medium', 'high']),
})

export const CommonFailureSchema = z.object({
  symptom: z.string().min(1),
  likelyCause: z.string().default(''),
  fix: z.string().default(''),
})

export const CreateRunbookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  serviceTypes: z.array(z.string()).default([]),
  appliesToTags: z.array(z.string()).default([]),
  firstChecks: z.array(z.string()).default([]),
  contacts: z.array(z.string()).default([]),
  commonFailures: z.array(CommonFailureSchema).default([]),
  recoverySteps: z.array(RecoveryStepSchema).default([]),
  links: z.array(z.string().url()).default([]),
  notes: z.string().default(''),
})

export const UpdateRunbookSchema = CreateRunbookSchema.partial()

export type CreateRunbookInput = z.infer<typeof CreateRunbookSchema>
export type UpdateRunbookInput = z.infer<typeof UpdateRunbookSchema>
