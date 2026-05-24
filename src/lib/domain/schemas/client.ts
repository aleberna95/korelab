import { z } from 'zod'

export const CreateClientSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
  taxCode: z.string().optional(),
  address: z.string().optional(),
  pec: z.string().email('PEC non valida').optional().or(z.literal('')),
  sdi: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['active', 'archived']).default('active'),
})

export const UpdateClientSchema = CreateClientSchema.partial()

export type CreateClientInput = z.infer<typeof CreateClientSchema>
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
