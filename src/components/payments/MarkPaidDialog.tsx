'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { markInstallmentPaid } from '@/lib/actions/payments'
import type { PaymentInstallment } from '@/lib/domain/payments'

interface Props {
  open: boolean
  installment: PaymentInstallment | null
  paymentId: string
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MarkPaidDialog({ open, installment, paymentId, onOpenChange, onSuccess }: Props) {
  const [pending, setPending] = useState(false)
  const [paidDate, setPaidDate] = useState(todayISO())
  const [paidMethod, setPaidMethod] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!installment) return
    if (!paidDate) {
      setError('Inserisci la data di pagamento.')
      return
    }
    setError(null)
    setPending(true)
    try {
      await markInstallmentPaid(paymentId, installment.id, {
        paidDate,
        paidMethod: paidMethod.trim() || undefined,
        note: note.trim() || undefined,
      })
      // Reset form for next use
      setPaidDate(todayISO())
      setPaidMethod('')
      setNote('')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il salvataggio.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Segna pagata — {installment?.label}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-fg-muted)]">
              Data di pagamento <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="date"
              required
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Method */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-fg-muted)]">Metodo di pagamento</label>
            <input
              type="text"
              value={paidMethod}
              onChange={(e) => setPaidMethod(e.target.value)}
              placeholder="es. bonifico, contanti…"
              className="block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-fg-muted)]">Note (opzionale)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

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
              {pending ? 'Salvataggio…' : 'Conferma'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
