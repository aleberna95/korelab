import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { ClientForm } from '@/components/clients/ClientForm'

export const metadata: Metadata = { title: 'Nuovo cliente — Command Center' }

export default async function NewClientPage() {
  await requireAdmin()

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <Link
          href="/admin/clients"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
        >
          ← Clienti
        </Link>
        <h1 className="text-h1 font-semibold text-[var(--color-fg)] mt-3">Nuovo cliente</h1>
      </div>
      <ClientForm />
    </div>
  )
}
