import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { quotesRepo } from '@/lib/repos/quotesRepo'
import { QuoteEditor } from '@/components/quotes/QuoteEditor'

export const metadata: Metadata = { title: 'Editor preventivo — KoreLab' }

type Props = { params: Promise<{ id: string }> }

export default async function QuotePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const quote = await quotesRepo.getById(id)
  if (!quote) notFound()

  return <QuoteEditor initialQuote={quote} />
}
