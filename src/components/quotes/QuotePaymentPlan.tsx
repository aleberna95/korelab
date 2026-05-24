'use client'

import { useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { updateQuoteDraft } from '@/lib/actions/quotes'
import { buildInstallments } from '@/lib/quotes/installments'
import { toCents, fromCents, formatEUR } from '@/lib/money'
import type { PaymentPlan, InstallmentCadence, CadenceUnit } from '@/lib/domain/quotes'
import type { PaymentInstallment } from '@/lib/domain/payments'

// ─── Constants ────────────────────────────────────────────────────────────────

const CADENCE_OPTIONS: { value: InstallmentCadence; label: string }[] = [
  { value: 'weekly', label: 'Settimanale' },
  { value: 'monthly', label: 'Mensile' },
  { value: 'quarterly', label: 'Trimestrale' },
  { value: 'semiannual', label: 'Semestrale' },
  { value: 'yearly', label: 'Annuale' },
  { value: 'custom', label: 'Personalizzata' },
]

const UNIT_OPTIONS: { value: CadenceUnit; label: string }[] = [
  { value: 'day', label: 'Giorno' },
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
  { value: 'year', label: 'Anno' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatITDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function InstallmentPreview({
  totalCents,
  payment,
}: {
  totalCents: number
  payment: PaymentPlan
}) {
  const accontoCents = payment.acconto?.amountCents ?? 0
  const netTotal = Math.max(0, totalCents - accontoCents)

  let rates: PaymentInstallment[] = []
  let previewError: string | null = null

  if (payment.mode === 'installments' && payment.installments) {
    const { count, cadence, custom } = payment.installments
    try {
      rates = buildInstallments({
        totalCents: netTotal,
        count: Math.max(1, count),
        cadence,
        custom,
        startDate: payment.installments?.firstInstallmentDate ?? todayISO(),
      })
    } catch (e) {
      previewError = e instanceof Error ? e.message : 'Errore calcolo rate'
    }
  }

  const hasRows = accontoCents > 0 || rates.length > 0 || payment.mode === 'lump-sum'

  if (!hasRows) return null

  const rowCls = 'flex items-center justify-between gap-4 py-2 px-4 text-sm'
  const labelCls = 'text-[var(--color-fg-muted)]'
  const amountCls = 'tabular-nums font-medium text-[var(--color-fg)] shrink-0'
  const dateCls = 'text-xs text-[var(--color-fg-faint)] shrink-0'

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide">
        Anteprima rate
      </h3>

      {previewError ? (
        <p className="text-sm text-[var(--color-danger)]">{previewError}</p>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
          {/* Lump-sum */}
          {payment.mode === 'lump-sum' && (
            <>
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
              <div className={`${rowCls} bg-[var(--color-bg)]`}>
                <span className={labelCls}>
                  {accontoCents > 0 ? 'Saldo' : 'Unica soluzione'}
                </span>
                <span className={amountCls}>{formatEUR(netTotal)}</span>
              </div>
            </>
          )}

          {/* Installments */}
          {payment.mode === 'installments' && (
            <>
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
              {rates.map((r, i) => (
                <div
                  key={r.id}
                  className={`${rowCls} ${i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'}`}
                >
                  <span className={labelCls}>{r.label}</span>
                  <div className="flex items-center gap-3">
                    {payment.installments?.firstInstallmentDate && (
                      <span className={dateCls}>{formatITDate(r.expectedDate)}</span>
                    )}
                    <span className={amountCls}>{formatEUR(r.amountCents)}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Total footer */}
          <div className="border-t border-[var(--color-border)]">
            <div className={`${rowCls} bg-[var(--color-surface)] font-semibold`}>
              <span className="text-[var(--color-fg)]">Totale</span>
              <span className="tabular-nums text-[var(--color-fg)]">
                {formatEUR(totalCents)}
              </span>
            </div>
          </div>
        </div>
      )}

      {payment.mode === 'installments' && rates.length > 0 && !payment.installments?.firstInstallmentDate && (
        <p className="text-xs text-[var(--color-fg-faint)] pt-1">
          Le date esatte verranno confermate all'approvazione del preventivo.
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuotePaymentPlan({
  quoteId,
  initialPayment,
  totalCents,
  readonly = false,
}: {
  quoteId: string
  initialPayment: PaymentPlan
  totalCents: number
  readonly?: boolean
}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<PaymentPlan['mode']>(initialPayment.mode)
  const [count, setCount] = useState(initialPayment.installments?.count ?? 3)
  const [cadence, setCadence] = useState<InstallmentCadence>(
    initialPayment.installments?.cadence ?? 'monthly',
  )
  const [customEvery, setCustomEvery] = useState(
    initialPayment.installments?.custom?.every ?? 1,
  )
  const [customUnit, setCustomUnit] = useState<CadenceUnit>(
    initialPayment.installments?.custom?.unit ?? 'month',
  )
  const [hasAcconto, setHasAcconto] = useState(
    !!(initialPayment.acconto?.amountCents && initialPayment.acconto.amountCents > 0),
  )
  const [accontoCents, setAccontoCents] = useState(
    initialPayment.acconto?.amountCents ?? 0,
  )
  const [accontoStr, setAccontoStr] = useState(() =>
    fromCents(initialPayment.acconto?.amountCents ?? 0).toFixed(2),
  )
  const [accontoDate, setAccontoDate] = useState(
    initialPayment.acconto?.expectedDate ?? '',
  )
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    initialPayment.installments?.firstInstallmentDate ?? '',
  )

  const [, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildPlan(overrides?: Partial<{
    mode: PaymentPlan['mode']
    count: number
    cadence: InstallmentCadence
    customEvery: number
    customUnit: CadenceUnit
    hasAcconto: boolean
    accontoCents: number
    accontoDate: string
    firstInstallmentDate: string
  }>): PaymentPlan {
    const m = overrides?.mode ?? mode
    const cnt = overrides?.count ?? count
    const cad = overrides?.cadence ?? cadence
    const cEvery = overrides?.customEvery ?? customEvery
    const cUnit = overrides?.customUnit ?? customUnit
    const ha = overrides?.hasAcconto ?? hasAcconto
    const ac = overrides?.accontoCents ?? accontoCents
    const ad = overrides?.accontoDate ?? accontoDate
    const fid =
      overrides && 'firstInstallmentDate' in overrides
        ? overrides.firstInstallmentDate!
        : firstInstallmentDate

    return {
      mode: m,
      ...(m === 'installments' && {
        installments: {
          count: cnt,
          cadence: cad,
          ...(cad === 'custom' && { custom: { every: cEvery, unit: cUnit } }),
          ...(fid && { firstInstallmentDate: fid }),
        },
      }),
      ...(ha && ac > 0 && {
        acconto: {
          amountCents: ac,
          ...(ad && { expectedDate: ad }),
        },
      }),
    }
  }

  function scheduleSave(plan: PaymentPlan) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      startTransition(() => {
        updateQuoteDraft(quoteId, { payment: plan }).catch(() =>
          toast.error('Salvataggio piano pagamento fallito. Riprova.'),
        )
      })
    }, 400)
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleModeChange(newMode: PaymentPlan['mode']) {
    setMode(newMode)
    scheduleSave(buildPlan({ mode: newMode }))
  }

  function handleCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(1, parseInt(e.target.value, 10) || 1)
    setCount(v)
    scheduleSave(buildPlan({ count: v }))
  }

  function handleCadenceChange(c: InstallmentCadence) {
    setCadence(c)
    scheduleSave(buildPlan({ cadence: c }))
  }

  function handleCustomEveryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(1, parseInt(e.target.value, 10) || 1)
    setCustomEvery(v)
    scheduleSave(buildPlan({ customEvery: v }))
  }

  function handleCustomUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as CadenceUnit
    setCustomUnit(v)
    scheduleSave(buildPlan({ customUnit: v }))
  }

  function handleAccontoToggle() {
    const next = !hasAcconto
    setHasAcconto(next)
    if (!next) {
      setAccontoCents(0)
      setAccontoStr('0.00')
      setAccontoDate('')
    }
    scheduleSave(buildPlan({ hasAcconto: next, accontoCents: next ? accontoCents : 0 }))
  }

  function handleAccontoAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(',', '.')
    setAccontoStr(e.target.value)
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) {
      const c = toCents(n)
      setAccontoCents(c)
      scheduleSave(buildPlan({ accontoCents: c }))
    }
  }

  function handleAccontoAmountBlur() {
    const n = parseFloat(accontoStr.replace(',', '.'))
    const safe = isNaN(n) || n < 0 ? 0 : n
    setAccontoStr(safe.toFixed(2))
    const c = toCents(safe)
    setAccontoCents(c)
    scheduleSave(buildPlan({ accontoCents: c }))
  }

  function handleAccontoDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAccontoDate(e.target.value)
    scheduleSave(buildPlan({ accontoDate: e.target.value }))
  }

  function handleFirstInstallmentDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFirstInstallmentDate(e.target.value)
    scheduleSave(buildPlan({ firstInstallmentDate: e.target.value }))
  }

  function handleFirstInstallmentDateClear() {
    setFirstInstallmentDate('')
    scheduleSave(buildPlan({ firstInstallmentDate: '' }))
  }

  // ── Live payment plan for preview ─────────────────────────────────────────
  const livePlan: PaymentPlan = buildPlan()

  // ── Shared input classes ──────────────────────────────────────────────────
  const inputCls =
    'h-9 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed'

  const toggleBtnCls = (active: boolean) =>
    `h-10 px-4 text-sm font-medium transition-colors border ${
      active
        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
        : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
    }`

  return (
    <div className="space-y-6">
      {/* ── Mode toggle ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide">
          Modalità pagamento
        </label>
        <div className="flex rounded-[var(--radius-sm)] overflow-hidden border border-[var(--color-border)] w-fit">
          <button
            type="button"
            disabled={readonly}
            onClick={() => handleModeChange('lump-sum')}
            className={`${toggleBtnCls(mode === 'lump-sum')} rounded-none border-0 border-r border-[var(--color-border)]`}
          >
            Unica soluzione
          </button>
          <button
            type="button"
            disabled={readonly}
            onClick={() => handleModeChange('installments')}
            className={`${toggleBtnCls(mode === 'installments')} rounded-none border-0`}
          >
            Rate
          </button>
        </div>
      </div>

      {/* ── Installments config ───────────────────────────────────────────── */}
      {mode === 'installments' && (
        <div className="space-y-4 pl-0">
          {/* Count */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--color-fg-muted)] shrink-0">
              Numero di rate
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={count}
              onChange={handleCountChange}
              disabled={readonly}
              className={`${inputCls} w-20 text-center`}
            />
          </div>

          {/* Cadence */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-fg-muted)]">Cadenza</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CADENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readonly}
                  onClick={() => handleCadenceChange(opt.value)}
                  className={`h-9 px-3 rounded-[var(--radius-sm)] text-sm font-medium border transition-colors ${
                    cadence === opt.value
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                  } disabled:opacity-50 disabled:pointer-events-none`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom cadence inputs */}
            {cadence === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-[var(--color-fg-muted)]">Ogni</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customEvery}
                  onChange={handleCustomEveryChange}
                  disabled={readonly}
                  className={`${inputCls} w-16 text-center`}
                />
                <select
                  value={customUnit}
                  onChange={handleCustomUnitChange}
                  disabled={readonly}
                  className={`${inputCls} w-32`}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* First installment date — optional */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--color-fg-muted)] shrink-0 w-28">
              Data prima rata
            </label>
            <input
              type="date"
              value={firstInstallmentDate}
              onChange={handleFirstInstallmentDateChange}
              disabled={readonly}
              className={`${inputCls} w-40`}
            />
            {firstInstallmentDate && !readonly && (
              <button
                type="button"
                onClick={handleFirstInstallmentDateClear}
                className="text-xs text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] transition-colors"
                aria-label="Rimuovi data prima rata"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Acconto toggle ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide">
            Acconto
          </label>
          <button
            type="button"
            disabled={readonly}
            onClick={handleAccontoToggle}
            role="switch"
            aria-checked={hasAcconto}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
              hasAcconto ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
                hasAcconto ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {hasAcconto && (
          <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            {/* Amount */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--color-fg-muted)] shrink-0 w-28">
                Importo (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={accontoStr}
                onChange={handleAccontoAmountChange}
                onBlur={handleAccontoAmountBlur}
                disabled={readonly}
                className={`${inputCls} w-32 text-right`}
              />
            </div>

            {/* Expected date */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--color-fg-muted)] shrink-0 w-28">
                Data prevista
              </label>
              <input
                type="date"
                value={accontoDate}
                onChange={handleAccontoDateChange}
                disabled={readonly}
                className={`${inputCls} w-40`}
              />
            </div>

            {mode === 'installments' && accontoCents > 0 && (
              <p className="text-xs text-[var(--color-fg-faint)]">
                Le rate verranno calcolate sul totale meno l'acconto
                ({formatEUR(Math.max(0, totalCents - accontoCents))}).
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Preview ───────────────────────────────────────────────────────── */}
      <InstallmentPreview totalCents={totalCents} payment={livePlan} />
    </div>
  )
}
