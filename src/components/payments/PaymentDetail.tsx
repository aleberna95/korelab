'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Circle, CircleCheck, AlertCircle, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MarkPaidDialog } from './MarkPaidDialog'
import { reopenInstallment, cancelPayment } from '@/lib/actions/payments'
import type { Payment, PaymentInstallment } from '@/lib/domain/payments'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentDetail({ initialPayment }: { initialPayment: Payment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [markingInst, setMarkingInst] = useState<PaymentInstallment | null>(null)

  const today = todayISO()
  const paidCount = initialPayment.installments.filter((i) => i.status === 'paid').length
  const totalCount = initialPayment.installments.length
  const isCompleted = initialPayment.status === 'completed'
  const isCancelled = initialPayment.status === 'cancelled'

  function handleReopen(installmentId: string) {
    if (!confirm('Riaprire la rata? Verrà riportata in stato "in attesa".')) return
    startTransition(async () => {
      try {
        await reopenInstallment(initialPayment.id, installmentId)
        router.refresh()
        toast.success('Rata riaperta.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore.')
      }
    })
  }

  function handleCancel() {
    if (!confirm('Annullare il pagamento? Questa operazione non può essere annullata.')) return
    startTransition(async () => {
      try {
        await cancelPayment(initialPayment.id)
        router.refresh()
        toast.success('Pagamento annullato.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore.')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/payments"
            className="shrink-0 p-1.5 -ml-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <span className="font-mono text-base font-semibold text-[var(--color-fg)] block">
              {initialPayment.number}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
              <Link
                href={`/admin/quotes/${initialPayment.quoteId}`}
                className="font-mono hover:text-[var(--color-accent)] transition-colors"
              >
                {initialPayment.quoteNumber}
              </Link>
              <span>·</span>
              <span>{initialPayment.clientSnapshot.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-base font-semibold text-[var(--color-fg)] block">
              {formatEUR(initialPayment.totalCents)}
            </span>
            {isCompleted && (
              <span className="text-xs font-medium text-[oklch(0.40_0.14_150)]">Completato</span>
            )}
            {isCancelled && (
              <span className="text-xs font-medium text-[var(--color-fg-faint)]">Annullato</span>
            )}
            {!isCompleted && !isCancelled && (
              <span className="text-xs text-[var(--color-fg-muted)]">
                {paidCount}/{totalCount} pagate
              </span>
            )}
          </div>

          {/* Kebab */}
          {!isCancelled && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="shrink-0 p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition-colors"
                aria-label="Azioni pagamento"
              >
                <MoreVertical size={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleCancel}
                  disabled={isPending}
                  className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
                >
                  Annulla pagamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-fg-muted)]">
          Questo pagamento è stato annullato.
        </div>
      )}

      {/* ── Installment timeline ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {initialPayment.installments.map((inst) => {
          const isPaid = inst.status === 'paid'
          const isCancInst = inst.status === 'cancelled'
          const isOverdue = !isPaid && !isCancInst && inst.expectedDate < today

          return (
            <div
              key={inst.id}
              className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border transition-colors ${
                isPaid
                  ? 'bg-[oklch(0.95_0.06_150)] border-[oklch(0.86_0.10_150)]'
                  : isOverdue
                  ? 'bg-[oklch(0.96_0.06_25)] border-[oklch(0.88_0.10_25)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)]'
              }`}
            >
              {/* Status dot */}
              <div className="mt-0.5 shrink-0">
                {isPaid ? (
                  <CircleCheck size={16} className="text-[oklch(0.55_0.14_150)]" />
                ) : isOverdue ? (
                  <AlertCircle size={16} className="text-[var(--color-danger)]" />
                ) : (
                  <Circle size={16} className="text-[var(--color-fg-faint)]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span
                    className={`text-sm font-medium ${
                      isPaid
                        ? 'text-[oklch(0.40_0.14_150)]'
                        : isOverdue
                        ? 'text-[oklch(0.45_0.16_25)]'
                        : 'text-[var(--color-fg)]'
                    }`}
                  >
                    {inst.label}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      isPaid ? 'text-[oklch(0.40_0.14_150)]' : 'text-[var(--color-fg)]'
                    }`}
                  >
                    {formatEUR(inst.amountCents)}
                  </span>
                </div>
                <p className="text-xs mt-0.5 text-[var(--color-fg-muted)]">
                  {isPaid ? (
                    <>
                      Pagato il {formatDate(inst.paidDate!)}
                      {inst.paidMethod ? ` · ${inst.paidMethod}` : ''}
                    </>
                  ) : (
                    <>
                      {isOverdue ? 'Scaduta il ' : 'Atteso il '}
                      {formatDate(inst.expectedDate)}
                    </>
                  )}
                </p>
                {inst.note && (
                  <p className="text-xs mt-0.5 text-[var(--color-fg-faint)] italic">{inst.note}</p>
                )}
              </div>

              {/* Action button */}
              {!isCancelled && (
                <div className="shrink-0">
                  {isPaid ? (
                    <button
                      onClick={() => handleReopen(inst.id)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[oklch(0.86_0.10_150)] text-[oklch(0.40_0.14_150)] hover:bg-[oklch(0.90_0.08_150)] disabled:opacity-50 transition-colors"
                    >
                      Riapri
                    </button>
                  ) : !isCancInst ? (
                    <button
                      onClick={() => setMarkingInst(inst)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 transition-colors"
                    >
                      Segna pagata
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Mark paid dialog ─────────────────────────────────────────────── */}
      <MarkPaidDialog
        open={!!markingInst}
        installment={markingInst}
        paymentId={initialPayment.id}
        onOpenChange={(open) => !open && setMarkingInst(null)}
        onSuccess={() => {
          setMarkingInst(null)
          router.refresh()
          toast.success('Rata segnata come pagata.')
        }}
      />
    </div>
  )
}
