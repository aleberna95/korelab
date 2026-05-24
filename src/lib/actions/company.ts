'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { companyRepo } from '@/lib/repos/companyRepo'
import { SaveCompanySettingsSchema } from '@/lib/domain/schemas/company'
import type { SaveCompanySettingsInput } from '@/lib/domain/schemas/company'
import type { CompanySettings } from '@/lib/domain/company'

export async function saveCompanySettings(input: SaveCompanySettingsInput): Promise<void> {
  const { uid } = await requireAdmin()

  const validated = SaveCompanySettingsSchema.parse(input)

  // Scrub empty strings to undefined to avoid storing blank fields
  const clean: CompanySettings = {
    legalName: validated.legalName,
    defaultVatPercent: validated.defaultVatPercent,
    ...(validated.vatNumber && { vatNumber: validated.vatNumber }),
    ...(validated.taxCode && { taxCode: validated.taxCode }),
    ...(validated.email && { email: validated.email }),
    ...(validated.phone && { phone: validated.phone }),
    ...(validated.iban && { iban: validated.iban }),
    ...(validated.pec && { pec: validated.pec }),
    ...(validated.sdi && { sdi: validated.sdi }),
    ...(validated.logoUrl && { logoUrl: validated.logoUrl }),
    ...(validated.pdfAccentHex && { pdfAccentHex: validated.pdfAccentHex }),
    ...(validated.footerNote && { footerNote: validated.footerNote }),
    ...(validated.address && Object.values(validated.address).some(Boolean)
      ? { address: validated.address }
      : {}),
    ...(validated.footerIcons?.length ? { footerIcons: validated.footerIcons } : {}),
  }

  await companyRepo.save(uid, clean)
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const { uid } = await requireAdmin()
  return companyRepo.get(uid)
}
