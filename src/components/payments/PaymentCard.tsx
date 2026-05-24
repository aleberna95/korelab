import Link from 'next/link'
import type { Payment, PaymentInstallment } from '@/lib/domain/payments'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEUR(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function nextPendingInstallment(installments: PaymentInstallment[]): PaymentInstallment | null {
  const pending = installments
    .filter((i) => i.status === 'pending')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
  return pending[0] ?? null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentCard({ payment }: { payment: Payment }) {
  const total = payment.installments.length
  const paid = payment.installments.filter((i) => i.status === 'paid').length
  const progress = total > 0 ? Math.round((paid / total) * 100) : 0
  const isCompleted = payment.status === 'completed'

  const today = todayISO()
  const in7days = addDays(today, 7)
  const next = nextPendingInstallment(payment.installments)
  const isUrgent = next ? next.expectedDate <= in7days : false
  const isOverdue = next ? next.expectedDate < today : false

  return (
    <Link
      href={`/admin/payments/${payment.id}`}
      className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent)] transition-colors"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-mono text-sm font-semibold text-[var(--color-fg)]">
          {payment.number}
        </span>
        {isCompleted ? (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[oklch(0.95_0.06_150)] text-[oklch(0.40_0.14_150)] border border-[oklch(0.86_0.10_150)]">
            Completato
          </span>
        ) : isOverdue ? (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)] border border-[oklch(0.88_0.10_25)]">
            In ritardo
          </span>
        ) : null}
      </div>

      {/* Quote link + client */}
      <div className="text-xs text-[var(--color-fg-muted)] mb-0.5">
        <span
          className="font-mono hover:text-[var(--color-accent)] transition-colors"
          onClick={(e) => {
            e.preventDefault()
            window.location.href = `/admin/quotes/${payment.quoteId}`
          }}
        >
          {payment.quoteNumber}
        </span>
        {' · '}
        {payment.clientSnapshot.name}
      </div>

      {/* Amount + progress count */}
      <div className="flex items-center justify-between text-sm mt-2 mb-1.5">
        <span className="font-medium text-[var(--color-fg)]">
          {formatEUR(payment.totalCents)}
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">
          {paid}/{total} pagate
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isCompleted ? 'bg-[oklch(0.55_0.14_150)]' : 'bg-[var(--color-accent)]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Next scadenza */}
      {next && !isCompleted && (
        <p
          className={`mt-2 text-xs ${
            isOverdue
              ? 'text-[var(--color-danger)] font-medium'
              : isUrgent
              ? 'text-[oklch(0.50_0.15_55)] font-medium'
              : 'text-[var(--color-fg-faint)]'
          }`}
        >
          {isOverdue ? 'Scaduta il ' : 'Prossima il '}
          {formatDate(next.expectedDate)}
          {' · '}
          {formatEUR(next.amountCents)}
        </p>
      )}
    </Link>
  )
}
