'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { approveQuote } from '@/lib/actions/quotes'
import type { Quote } from '@/lib/domain/quotes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'settimana',
  monthly: 'mese',
  quarterly: 'trimestre',
  semiannual: 'semestre',
  yearly: 'anno',
  custom: 'intervallo personalizzato',
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote
}

export function ApproveDialog({ open, onOpenChange, quote }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [accontoAlreadyPaid, setAccontoAlreadyPaid] = useState(false)
  const [accontoDate, setAccontoDate] = useState(
    quote.payment.acconto?.expectedDate ?? todayISO(),
  )
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)

  const hasAcconto = !!quote.payment.acconto
  const isInstallments = quote.payment.mode === 'installments'
  const cadenceLabel = isInstallments && quote.payment.installments
    ? CADENCE_LABELS[quote.payment.installments.cadence] ?? quote.payment.installments.cadence
    : null

  function validate(): string | null {
    if (hasAcconto && isInstallments && accontoDate && firstInstallmentDate) {
      if (accontoDate > firstInstallmentDate) {
        return 'La data acconto deve precedere la data della prima rata.'
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setPending(true)
    try {
      const { paymentId } = await approveQuote(quote.id, {
        accontoAlreadyPaid: hasAcconto ? accontoAlreadyPaid : undefined,
        accontoDate: hasAcconto ? accontoDate || undefined : undefined,
        firstInstallmentDate: firstInstallmentDate || undefined,
      })
      onOpenChange(false)
      toast.success('Preventivo approvato.')
      router.push(`/admin/payments/${paymentId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'approvazione.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            Approva {quote.number}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* ── Acconto section ─────────────────────────────────── */}
          {hasAcconto && (
            <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
              <p className="text-sm font-medium text-[var(--color-fg)]">Acconto</p>

              {/* Already paid toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  role="checkbox"
                  aria-checked={accontoAlreadyPaid}
                  tabIndex={0}
                  onClick={() => setAccontoAlreadyPaid((v) => !v)}
                  onKeyDown={(e) => e.key === ' ' && setAccontoAlreadyPaid((v) => !v)}
                  className={`relative h-5 w-9 rounded-full border transition-colors cursor-pointer
                    ${accontoAlreadyPaid
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-bg)] border-[var(--color-border)]'
                    }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
                      ${accontoAlreadyPaid ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </div>
                <span className="text-sm text-[var(--color-fg)]">Acconto già ricevuto</span>
              </label>

              {/* Date input */}
              <div className="space-y-1">
                <label className="text-xs text-[var(--color-fg-muted)]">
                  {accontoAlreadyPaid ? 'Data di ricezione' : 'Data prevista acconto'}
                </label>
                <input
                  type="date"
                  value={accontoDate}
                  onChange={(e) => setAccontoDate(e.target.value)}
                  className="block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* ── First installment / payment date ──────────────── */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-fg-muted)]">
              {isInstallments ? 'Data prima rata' : 'Data pagamento'}
            </label>
            <input
              type="date"
              value={firstInstallmentDate}
              onChange={(e) => setFirstInstallmentDate(e.target.value)}
              className="block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            {isInstallments && cadenceLabel && (
              <p className="text-xs text-[var(--color-fg-faint)]">
                Le rate successive saranno calcolate automaticamente ogni {cadenceLabel}.
              </p>
            )}
          </div>

          {/* ── Validation error ─────────────────────────────── */}
          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="px-4 py-2 rounded-[var(--radius-sm)] text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? 'Approvazione…' : 'Conferma approvazione'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
