import { z } from 'zod'

export const TaskStateSchema = z.enum(['todo', 'doing', 'done', 'cancelled'])

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().default(''),
  serviceId: z.string().optional(),
  incidentId: z.string().optional(),
  runbookId: z.string().optional(),
  runbookStepIndex: z.number().int().min(0).optional(),
  state: TaskStateSchema.default('todo'),
  /** ISO 8601 datetime string — repo converts to Firestore Timestamp */
  dueAt: z.string().datetime().optional(),
  notes: z.string().default(''),
})

export const UpdateTaskSchema = CreateTaskSchema.partial()

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>
