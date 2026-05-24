import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { quotesRepo } from '@/lib/repos/quotesRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { QuotesList } from '@/components/quotes/QuotesList'

export const metadata: Metadata = { title: 'Preventivi — KoreLab' }

export default async function QuotesPage() {
  await requireAdmin()

  const [quotes, clients] = await Promise.all([
    quotesRepo.list({ limit: 200 }),
    clientsRepo.list({ status: 'active', limit: 200 }),
  ])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <QuotesList
        initialQuotes={quotes}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  )
}
