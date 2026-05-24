'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Send } from 'lucide-react'
import { updateQuoteDraft, setQuoteStatus } from '@/lib/actions/quotes'
import { buildInstallments } from '@/lib/quotes/installments'
import { formatEUR } from '@/lib/money'
import type { Quote, QuoteDiscount, InstallmentCadence, CadenceUnit } from '@/lib/domain/quotes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatITDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Discount running balance (mirrors QuoteDiscounts logic) ─────────────────

type DiscountRow = QuoteDiscount & { appliedCents: number; runningAfterCents: number }

function computeDiscountRows(
  discounts: QuoteDiscount[],
  subtotal: number,
): { rows: DiscountRow[]; taxableCents: number } {
  let running = subtotal
  const rows: DiscountRow[] = discounts.map((d) => {
    const applied =
      d.kind === 'percent'
        ? Math.round(running * (d.value / 100))
        : Math.min(d.value, running)
    running -= applied
    return { ...d, appliedCents: applied, runningAfterCents: running }
  })
  return { rows, taxableCents: running }
}

// ─── Payment plan summary ─────────────────────────────────────────────────────

function PaymentSummary({ quote }: { quote: Quote }) {
  const { payment, totals } = quote
  const accontoCents = payment.acconto?.amountCents ?? 0
  const netTotal = Math.max(0, totals.totalCents - accontoCents)

  let rates: ReturnType<typeof buildInstallments> = []
  try {
    if (payment.mode === 'installments' && payment.installments) {
      const { count, cadence, custom } = payment.installments
      rates = buildInstallments({
        totalCents: netTotal,
        count: Math.max(1, count),
        cadence: cadence as InstallmentCadence,
        custom: custom as { every: number; unit: CadenceUnit } | undefined,
        startDate: todayISO(),
      })
    }
  } catch {
    // ignore preview errors
  }

  const rowCls = 'flex items-center justify-between gap-4 py-2 px-4 text-sm'
  const labelCls = 'text-[var(--color-fg-muted)]'
  const amountCls = 'tabular-nums font-medium text-[var(--color-fg)] shrink-0'
  const dateCls = 'text-xs text-[var(--color-fg-faint)] shrink-0'

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
      {/* Acconto */}
      {accontoCents > 0 && (
        <div className={`${rowCls} bg-[var(--color-surface)]`}>
          <span className={labelCls}>
            Acconto
            {payment.acconto?.expectedDate && (
              <span className={`${dateCls} ml-2`}>
                entro {formatITDate(payment.acconto.expectedDate)}
              </span>
            )}
          </span>
          <span className={amountCls}>{formatEUR(accontoCents)}</span>
        </div>
      )}

      {/* Lump-sum */}
      {payment.mode === 'lump-sum' && (
        <div className={`${rowCls} bg-[var(--color-bg)]`}>
          <span className={labelCls}>{accontoCents > 0 ? 'Saldo' : 'Unica soluzione'}</span>
          <span className={amountCls}>{formatEUR(netTotal)}</span>
        </div>
      )}

      {/* Installments */}
      {payment.mode === 'installments' &&
        rates.map((r, i) => (
          <div
            key={r.id}
            className={`${rowCls} ${i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'}`}
          >
            <span className={labelCls}>{r.label}</span>
            <div className="flex items-center gap-3">
              <span className={dateCls}>{formatITDate(r.expectedDate)}</span>
              <span className={amountCls}>{formatEUR(r.amountCents)}</span>
            </div>
          </div>
        ))}

      {/* Total */}
      <div className={`${rowCls} bg-[var(--color-surface)] border-t border-[var(--color-border)] font-semibold`}>
        <span className="text-[var(--color-fg)]">Totale</span>
        <span className="tabular-nums font-bold text-[var(--color-fg)]">
          {formatEUR(totals.totalCents)}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteRecap({ initialQuote }: { initialQuote: Quote }) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialQuote.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(initialQuote.notes ?? '')
  const [isApproving, startApproving] = useTransition()
  const [, startSaving] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLocked = initialQuote.status !== 'bozza'
  const notesDirty = notes !== savedNotes
  const { subtotalCents, vatCents, totalCents } = initialQuote.totals
  const { rows: discountRows } = computeDiscountRows(
    initialQuote.discounts,
    subtotalCents,
  )

  // ── Notes save ────────────────────────────────────────────────────────────

  function scheduleNotesSave(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      startSaving(() => {
        updateQuoteDraft(initialQuote.id, { notes: value })
          .then(() => setSavedNotes(value))
          .catch(() => toast.error('Salvataggio note fallito.'))
      })
    }, 400)
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNotes(e.target.value)
    scheduleNotesSave(e.target.value)
  }

  async function flushNotes() {
    if (!notesDirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await updateQuoteDraft(initialQuote.id, { notes })
      setSavedNotes(notes)
    } catch {
      toast.error('Salvataggio note fallito.')
    }
  }

  // ── Manda in approvazione ─────────────────────────────────────────────────

  function handleSendForApproval() {
    if (
      !confirm(
        'Mandare il preventivo in approvazione?\nNon sarà più possibile modificarlo finché non viene riportato in bozza.',
      )
    )
      return

    startApproving(async () => {
      try {
        await flushNotes()
        await setQuoteStatus(initialQuote.id, 'in-approvazione')
        toast.success('Preventivo inviato in approvazione.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore durante la transizione.')
      }
    })
  }

  const sectionTitleCls =
    'text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide mb-3'

  return (
    <div className="space-y-8">
      {/* ── Cliente ──────────────────────────────────────────────────────── */}
      <div>
        <h3 className={sectionTitleCls}>Cliente</h3>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius)] px-4 py-3 space-y-1 text-sm">
          <p className="font-medium text-[var(--color-fg)]">{initialQuote.clientSnapshot.name}</p>
          {initialQuote.clientSnapshot.email && (
            <p className="text-[var(--color-fg-muted)]">{initialQuote.clientSnapshot.email}</p>
          )}
          {initialQuote.clientSnapshot.phone && (
            <p className="text-[var(--color-fg-muted)]">{initialQuote.clientSnapshot.phone}</p>
          )}
        </div>
      </div>

      {/* ── Righe ────────────────────────────────────────────────────────── */}
      {initialQuote.lines.length > 0 && (
        <div>
          <h3 className={sectionTitleCls}>Righe</h3>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden text-sm">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1fr_4rem_7rem_6rem] gap-2 px-4 py-2 bg-[var(--color-bg)] text-xs text-[var(--color-fg-faint)] uppercase tracking-wide border-b border-[var(--color-border)]">
              <span>Descrizione</span>
              <span className="text-center">Qtà</span>
              <span className="text-right">Prezzo</span>
              <span className="text-right">Totale</span>
            </div>
            {initialQuote.lines.map((line, i) => (
              <div
                key={line.id}
                className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_4rem_7rem_6rem] gap-x-4 gap-y-0.5 px-4 py-2.5 ${
                  i % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-bg)]'
                }`}
              >
                <span className="text-[var(--color-fg)]">{line.description || '—'}</span>
                <span className="hidden md:block text-center text-[var(--color-fg-muted)]">
                  {line.qty}
                </span>
                <span className="hidden md:block text-right text-[var(--color-fg-muted)] tabular-nums">
                  {formatEUR(line.unitPriceCents)}
                </span>
                <span className="text-right font-medium text-[var(--color-fg)] tabular-nums">
                  {formatEUR(line.qty * line.unitPriceCents)}
                </span>
                {/* Mobile: qty + unit price */}
                <span className="md:hidden text-xs text-[var(--color-fg-faint)] col-span-2">
                  {line.qty} × {formatEUR(line.unitPriceCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Totali ───────────────────────────────────────────────────────── */}
      <div>
        <h3 className={sectionTitleCls}>Totali</h3>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden text-sm">
          {/* Subtotale */}
          <div className="flex justify-between px-4 py-2.5 bg-[var(--color-surface)]">
            <span className="text-[var(--color-fg-muted)]">Subtotale</span>
            <span className="tabular-nums font-medium text-[var(--color-fg)]">
              {formatEUR(subtotalCents)}
            </span>
          </div>
          {/* Sconti */}
          {discountRows.map((row, i) => (
            <div
              key={row.id}
              className={`flex justify-between items-center px-4 py-2 ${
                i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'
              }`}
            >
              <span className="text-[var(--color-fg-muted)] truncate mr-4">
                {row.label || `Sconto ${i + 1}`}
                <span className="ml-1.5 text-xs text-[var(--color-fg-faint)]">
                  {row.kind === 'percent' ? `−${row.value}%` : '−€ fisso'}
                </span>
              </span>
              <span className="tabular-nums text-[var(--color-danger)] shrink-0">
                − {formatEUR(row.appliedCents)}
              </span>
            </div>
          ))}
          {/* Separator */}
          <div className="border-t border-[var(--color-border)] mx-4" />
          {/* Imponibile */}
          <div className="flex justify-between px-4 py-2.5 bg-[var(--color-surface)]">
            <span className="text-[var(--color-fg-muted)]">Imponibile</span>
            <span className="tabular-nums font-medium text-[var(--color-fg)]">
              {formatEUR(totalCents - vatCents)}
            </span>
          </div>
          {/* IVA */}
          <div className="flex justify-between px-4 py-2 bg-[var(--color-bg)]">
            <span className="text-[var(--color-fg-muted)]">IVA {initialQuote.vatPercent}%</span>
            <span className="tabular-nums text-[var(--color-fg-muted)]">
              + {formatEUR(vatCents)}
            </span>
          </div>
          {/* Separator */}
          <div className="border-t border-[var(--color-border)] mx-4" />
          {/* Totale */}
          <div className="flex justify-between px-4 py-3 bg-[var(--color-surface)]">
            <span className="font-semibold text-[var(--color-fg)]">Totale</span>
            <span className="tabular-nums font-bold text-lg text-[var(--color-fg)]">
              {formatEUR(totalCents)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Piano pagamento ───────────────────────────────────────────────── */}
      <div>
        <h3 className={sectionTitleCls}>Piano di pagamento</h3>
        <PaymentSummary quote={initialQuote} />
        {initialQuote.payment.mode === 'installments' && (
          <p className="text-xs text-[var(--color-fg-faint)] mt-1.5">
            Date indicative — confermate all'approvazione.
          </p>
        )}
      </div>

      {/* ── Note ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${sectionTitleCls} mb-0`}>Note</h3>
          {notesDirty && !isLocked && (
            <span className="text-xs text-[var(--color-fg-faint)]">Modifiche non salvate…</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          onBlur={flushNotes}
          disabled={isLocked}
          rows={4}
          placeholder="Note aggiuntive per il cliente…"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-[var(--color-fg-faint)]"
        />
      </div>

      {/* ── Actions (bozza only) ──────────────────────────────────────────── */}
      {!isLocked && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={handleSendForApproval}
            disabled={isApproving}
            className="flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none sm:w-auto w-full"
          >
            <Send size={16} />
            {isApproving ? 'Invio in corso…' : 'Manda in approvazione'}
          </button>
          {notesDirty && (
            <button
              type="button"
              onClick={flushNotes}
              className="flex items-center justify-center gap-2 h-12 px-5 rounded-[var(--radius)] border border-[var(--color-border)] text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] transition-colors sm:w-auto w-full"
            >
              <CheckCircle2 size={15} />
              Salva note
            </button>
          )}
        </div>
      )}

      {/* Approved state message */}
      {initialQuote.status === 'in-approvazione' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius)] bg-[oklch(0.96_0.06_85)] border border-[oklch(0.88_0.10_85)] text-sm text-[oklch(0.45_0.15_85)]">
          <Send size={15} className="shrink-0" />
          Preventivo inviato in approvazione. In attesa di conferma.
        </div>
      )}
      {initialQuote.status === 'approvato' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius)] bg-[oklch(0.95_0.06_150)] border border-[oklch(0.86_0.10_150)] text-sm text-[oklch(0.40_0.14_150)]">
          <CheckCircle2 size={15} className="shrink-0" />
          Preventivo approvato.
          {initialQuote.approvedAt &&
            ` Il ${formatITDate(initialQuote.approvedAt.slice(0, 10))}.`}
        </div>
      )}
    </div>
  )
}
