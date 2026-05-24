import Link from 'next/link'
import { formatEUR } from '@/lib/money'
import type { Quote, QuoteStatus } from '@/lib/domain/quotes'

const STATUS_BADGE: Record<
  QuoteStatus,
  { label: string; className: string }
> = {
  bozza: {
    label: 'Bozza',
    className:
      'bg-[var(--color-bg)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
  },
  'in-approvazione': {
    label: 'In approvazione',
    className:
      'bg-[oklch(0.96_0.06_85)] text-[oklch(0.45_0.15_85)] border border-[oklch(0.88_0.10_85)]',
  },
  approvato: {
    label: 'Approvato',
    className:
      'bg-[oklch(0.95_0.06_150)] text-[oklch(0.40_0.14_150)] border border-[oklch(0.86_0.10_150)]',
  },
  rifiutato: {
    label: 'Rifiutato',
    className:
      'bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)] border border-[oklch(0.88_0.10_25)]',
  },
}

export function QuoteListItem({ quote }: { quote: Quote }) {
  const badge = STATUS_BADGE[quote.status]
  const createdDate = quote.createdAt
    ? new Date(quote.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <Link
      href={`/admin/quotes/${quote.id}`}
      className="group flex flex-col gap-2 bg-[var(--color-surface)] rounded-[var(--radius)] p-4 border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors active:scale-[0.98]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Row 1: number + badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-[var(--color-fg)] tracking-tight">
          {quote.number}
        </span>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Row 2: client name */}
      <p className="text-[15px] font-medium text-[var(--color-fg)] truncate leading-snug">
        {quote.clientSnapshot.name}
      </p>

      {/* Row 3: total + date */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-sm font-semibold text-[var(--color-fg-muted)]">
          {formatEUR(quote.totals.totalCents)}
        </span>
        {createdDate && (
          <span className="text-xs text-[var(--color-fg-faint)]">{createdDate}</span>
        )}
      </div>
    </Link>
  )
}
