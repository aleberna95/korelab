import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getCompanySettings } from '@/lib/actions/company'
import { CompanyForm } from '@/components/settings/CompanyForm'

export const metadata: Metadata = { title: 'Dati azienda — KoreLab' }

export default async function CompanySettingsPage() {
  await requireAdmin()
  const settings = await getCompanySettings()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Dati azienda</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Questi dati appaiono nell&apos;intestazione e nel footer di ogni preventivo PDF.
        </p>
      </header>

      <CompanyForm initial={settings} />
    </div>
  )
}
