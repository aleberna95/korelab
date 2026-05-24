import { z } from 'zod'

export const FooterIconKindSchema = z.enum([
  'website',
  'email',
  'phone',
  'instagram',
  'linkedin',
  'custom',
])

export const CompanyFooterIconSchema = z.object({
  kind: FooterIconKindSchema,
  label: z.string().min(1),
  value: z.string().min(1),
})

export const CompanyAddressSchema = z.object({
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
})

export const SaveCompanySettingsSchema = z.object({
  legalName: z.string().min(1, 'Nome azienda obbligatorio'),
  vatNumber: z.string().optional(),
  taxCode: z.string().optional(),
  address: CompanyAddressSchema.optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  iban: z.string().optional(),
  pec: z.string().optional(),
  sdi: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  footerIcons: z.array(CompanyFooterIconSchema).max(6).optional(),
  defaultVatPercent: z.number().nonnegative().max(100).default(5),
  pdfAccentHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Inserisci un colore esadecimale valido (#rrggbb)')
    .optional(),
  footerNote: z.string().optional(),
})

export type SaveCompanySettingsInput = z.infer<typeof SaveCompanySettingsSchema>
