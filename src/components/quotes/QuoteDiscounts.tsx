'use client'

import { useState, useRef, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateQuoteDraft } from '@/lib/actions/quotes'
import { toCents, fromCents, formatEUR } from '@/lib/money'
import type { QuoteDiscount } from '@/lib/domain/quotes'

// ─── Running balance helpers ──────────────────────────────────────────────────

type DiscountRow = QuoteDiscount & {
  appliedCents: number
  runningAfterCents: number
}

function computeRows(
  discounts: QuoteDiscount[],
  subtotalCents: number,
): { rows: DiscountRow[]; taxableCents: number } {
  let running = subtotalCents
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

// ─── Sortable discount row ────────────────────────────────────────────────────

function SortableDiscount({
  discount,
  appliedCents,
  runningAfterCents,
  onUpdate,
  onDelete,
  readonly,
}: {
  discount: QuoteDiscount
  appliedCents: number
  runningAfterCents: number
  onUpdate: (d: QuoteDiscount) => void
  onDelete: (id: string) => void
  readonly?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: discount.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto',
  }

  // Local value string for percent or EUR input
  const [valueStr, setValueStr] = useState(() =>
    discount.kind === 'percent'
      ? String(discount.value)
      : fromCents(discount.value).toFixed(2),
  )

  function handleKindToggle(kind: QuoteDiscount['kind']) {
    if (kind === discount.kind) return
    // Reset value when switching kind
    const newValue = 0
    setValueStr(kind === 'percent' ? '0' : '0.00')
    onUpdate({ ...discount, kind, value: newValue })
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(',', '.')
    setValueStr(e.target.value)
    const n = parseFloat(raw)
    if (isNaN(n) || n < 0) return
    const newValue =
      discount.kind === 'percent' ? Math.min(100, n) : toCents(n)
    onUpdate({ ...discount, value: newValue })
  }

  function handleValueBlur() {
    const n = parseFloat(valueStr.replace(',', '.'))
    const safe = isNaN(n) || n < 0 ? 0 : n
    if (discount.kind === 'percent') {
      const clamped = Math.min(100, safe)
      setValueStr(String(clamped))
      onUpdate({ ...discount, value: clamped })
    } else {
      setValueStr(safe.toFixed(2))
      onUpdate({ ...discount, value: toCents(safe) })
    }
  }

  const inputCls =
    'h-9 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed w-full'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 space-y-2"
    >
      {/* Row 1: handle + label + delete */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          disabled={readonly}
          className="touch-none shrink-0 text-[var(--color-fg-faint)] hover:text-[var(--color-fg-muted)] cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          tabIndex={-1}
        >
          <GripVertical size={15} />
        </button>
        <input
          type="text"
          value={discount.label}
          onChange={(e) => onUpdate({ ...discount, label: e.target.value })}
          placeholder="Descrizione sconto…"
          disabled={readonly}
          className={`${inputCls} flex-1`}
        />
        {!readonly && (
          <button
            type="button"
            onClick={() => onDelete(discount.id)}
            className="shrink-0 flex items-center justify-center text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Row 2: kind toggle + value + computed amounts */}
      <div className="flex items-center gap-2 pl-[1.5rem]">
        {/* Kind toggle */}
        {!readonly ? (
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--color-border)] overflow-hidden shrink-0 text-xs font-medium">
            <button
              type="button"
              onClick={() => handleKindToggle('percent')}
              className={`h-9 px-3 transition-colors ${
                discount.kind === 'percent'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)]'
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleKindToggle('fixed')}
              className={`h-9 px-3 transition-colors border-l border-[var(--color-border)] ${
                discount.kind === 'fixed'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)]'
              }`}
            >
              €
            </button>
          </div>
        ) : (
          <span className="shrink-0 text-xs font-medium px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-fg-muted)]">
            {discount.kind === 'percent' ? '%' : '€'}
          </span>
        )}

        {/* Value input */}
        <input
          type="text"
          inputMode="decimal"
          value={valueStr}
          onChange={handleValueChange}
          onBlur={handleValueBlur}
          disabled={readonly}
          className={`${inputCls} w-24 text-right`}
        />

        {/* Applied + running */}
        <div className="flex items-center gap-2 ml-auto text-sm tabular-nums">
          <span className="text-[var(--color-danger)] font-medium">
            − {formatEUR(appliedCents)}
          </span>
          <span className="text-[var(--color-fg-faint)] text-xs hidden sm:inline">→</span>
          <span className="text-[var(--color-fg-muted)] hidden sm:inline">
            {formatEUR(runningAfterCents)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteDiscounts({
  quoteId,
  initialDiscounts,
  initialVatPercent,
  subtotalCents,
  readonly = false,
}: {
  quoteId: string
  initialDiscounts: QuoteDiscount[]
  initialVatPercent: number
  subtotalCents: number
  readonly?: boolean
}) {
  const [discounts, setDiscounts] = useState<QuoteDiscount[]>(initialDiscounts)
  const [vatPercent, setVatPercent] = useState(initialVatPercent)
  const [, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor),
  )

  function scheduleSave(newDiscounts: QuoteDiscount[], newVat: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      startTransition(() => {
        updateQuoteDraft(quoteId, {
          discounts: newDiscounts,
          vatPercent: newVat,
        }).catch(() => toast.error('Salvataggio fallito. Riprova.'))
      })
    }, 400)
  }

  function handleUpdateDiscount(updated: QuoteDiscount) {
    const newDiscounts = discounts.map((d) =>
      d.id === updated.id ? updated : d,
    )
    setDiscounts(newDiscounts)
    scheduleSave(newDiscounts, vatPercent)
  }

  function handleDeleteDiscount(id: string) {
    const newDiscounts = discounts.filter((d) => d.id !== id)
    setDiscounts(newDiscounts)
    scheduleSave(newDiscounts, vatPercent)
  }

  function handleAddDiscount() {
    const newDiscount: QuoteDiscount = {
      id: crypto.randomUUID(),
      label: '',
      kind: 'percent',
      value: 0,
    }
    const newDiscounts = [...discounts, newDiscount]
    setDiscounts(newDiscounts)
    scheduleSave(newDiscounts, vatPercent)
  }

  function handleVatChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
    setVatPercent(v)
    scheduleSave(discounts, v)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = discounts.findIndex((d) => d.id === active.id)
    const newIndex = discounts.findIndex((d) => d.id === over.id)
    const newDiscounts = arrayMove(discounts, oldIndex, newIndex)
    setDiscounts(newDiscounts)
    scheduleSave(newDiscounts, vatPercent)
  }

  // ── Compute running totals ──────────────────────────────────────────────────
  const { rows, taxableCents } = computeRows(discounts, subtotalCents)
  const discountTotalCents = subtotalCents - taxableCents
  const vatCents = Math.round(taxableCents * (vatPercent / 100))
  const totalCents = taxableCents + vatCents

  return (
    <div className="space-y-6">
      {/* ── IVA input ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--color-fg-muted)] shrink-0">
          IVA (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={vatPercent}
          onChange={handleVatChange}
          disabled={readonly}
          className="h-9 w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-fg)] text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
        />
      </div>

      {/* ── Discount list ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide">
          Sconti progressivi
        </h3>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={discounts.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {rows.map((row) => (
                <SortableDiscount
                  key={row.id}
                  discount={row}
                  appliedCents={row.appliedCents}
                  runningAfterCents={row.runningAfterCents}
                  onUpdate={handleUpdateDiscount}
                  onDelete={handleDeleteDiscount}
                  readonly={readonly}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {discounts.length === 0 && (
          <p className="text-sm text-[var(--color-fg-faint)] text-center py-4">
            Nessuno sconto applicato.
          </p>
        )}

        {!readonly && (
          <button
            type="button"
            onClick={handleAddDiscount}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline py-1"
          >
            <Plus size={14} />
            Aggiungi sconto
          </button>
        )}
      </div>

      {/* ── Progressive totals ────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden text-sm">
        {/* Subtotale */}
        <div className="flex justify-between items-center px-4 py-2.5 bg-[var(--color-surface)]">
          <span className="text-[var(--color-fg-muted)]">Subtotale</span>
          <span className="tabular-nums font-medium text-[var(--color-fg)]">
            {formatEUR(subtotalCents)}
          </span>
        </div>

        {/* Sconti */}
        {rows.map((row, i) => (
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

        {/* Separatore */}
        <div className="border-t border-[var(--color-border)] mx-4" />

        {/* Imponibile */}
        <div className="flex justify-between items-center px-4 py-2.5 bg-[var(--color-surface)]">
          <span className="text-[var(--color-fg-muted)]">
            Imponibile
            {discountTotalCents > 0 && (
              <span className="ml-1.5 text-xs text-[var(--color-fg-faint)]">
                (−{formatEUR(discountTotalCents)} sconti)
              </span>
            )}
          </span>
          <span className="tabular-nums font-medium text-[var(--color-fg)]">
            {formatEUR(taxableCents)}
          </span>
        </div>

        {/* IVA */}
        <div className="flex justify-between items-center px-4 py-2 bg-[var(--color-bg)]">
          <span className="text-[var(--color-fg-muted)]">IVA {vatPercent}%</span>
          <span className="tabular-nums text-[var(--color-fg-muted)]">
            + {formatEUR(vatCents)}
          </span>
        </div>

        {/* Separatore */}
        <div className="border-t border-[var(--color-border)] mx-4" />

        {/* Totale */}
        <div className="flex justify-between items-center px-4 py-3 bg-[var(--color-surface)]">
          <span className="font-semibold text-[var(--color-fg)]">Totale</span>
          <span className="tabular-nums font-bold text-lg text-[var(--color-fg)]">
            {formatEUR(totalCents)}
          </span>
        </div>
      </div>
    </div>
  )
}
