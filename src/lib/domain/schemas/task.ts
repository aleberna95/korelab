import { z } from 'zod'

export const TaskColorSchema = z.enum([
  'yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray',
])

export const CreateTaskSchema = z.object({
  text: z.string().min(1, 'Testo obbligatorio').max(2000),
  color: TaskColorSchema.default('yellow'),
  order: z.number().int(),
})

export const UpdateTaskSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  color: TaskColorSchema.optional(),
  order: z.number().int().optional(),
  done: z.boolean().optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>
