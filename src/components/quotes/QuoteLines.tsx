'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
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
import type { QuoteLine } from '@/lib/domain/quotes'

// ─── Auto-resize textarea ─────────────────────────────────────────────────────

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Sync height to content when expanded
  const syncHeight = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { onChange(e); if (focused) syncHeight() }}
      onFocus={() => { setFocused(true); setTimeout(syncHeight, 0) }}
      onBlur={() => { setFocused(false); if (ref.current) ref.current.style.height = '' }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className={[
        className,
        'resize-none leading-5 py-2',
        focused ? 'overflow-y-hidden' : 'overflow-hidden whitespace-nowrap',
      ].join(' ')}
      style={focused ? undefined : {
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } as React.CSSProperties}
    />
  )
}

// ─── Sortable line row ────────────────────────────────────────────────────────

function SortableLine({
  line,
  onUpdate,
  onDelete,
  readonly,
}: {
  line: QuoteLine
  onUpdate: (l: QuoteLine) => void
  onDelete: (id: string) => void
  readonly?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: line.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto',
  }

  const [priceStr, setPriceStr] = useState(() =>
    fromCents(line.unitPriceCents).toFixed(2),
  )

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(',', '.')
    setPriceStr(e.target.value)
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) {
      onUpdate({ ...line, unitPriceCents: toCents(n) })
    }
  }

  function handlePriceBlur() {
    const n = parseFloat(priceStr.replace(',', '.'))
    const safe = isNaN(n) || n < 0 ? 0 : n
    setPriceStr(safe.toFixed(2))
    onUpdate({ ...line, unitPriceCents: toCents(safe) })
  }

  const inputCls =
    'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed w-full'

  const lineTotal = line.qty * line.unitPriceCents

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col bg-[var(--color-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border)] overflow-hidden"
    >
      {/* ── Row 1: drag handle + description + delete ── */}
      <div className="flex items-start gap-2 px-2 pt-2 pb-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          disabled={readonly}
          className="mt-1.5 shrink-0 touch-none text-[var(--color-fg-faint)] hover:text-[var(--color-fg-muted)] cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          tabIndex={-1}
        >
          <GripVertical size={15} />
        </button>

        <AutoResizeTextarea
          value={line.description}
          onChange={(e) => onUpdate({ ...line, description: e.target.value })}
          placeholder="Descrizione…"
          disabled={readonly}
          className={inputCls}
        />

        {!readonly ? (
          <button
            type="button"
            onClick={() => onDelete(line.id)}
            className="mt-1.5 shrink-0 flex items-center justify-center text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
      </div>

      {/* ── Row 2: qty + price + total ── */}
      <div className="flex items-center gap-3 px-2 pb-2 pl-8">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-fg-faint)] shrink-0">Qtà</span>
          <input
            type="number"
            min="0"
            step="1"
            value={line.qty}
            onChange={(e) =>
              onUpdate({ ...line, qty: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            disabled={readonly}
            className={`${inputCls} h-7 w-16 text-center`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-fg-faint)] shrink-0">Prezzo (€)</span>
          <input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={handlePriceChange}
            onBlur={handlePriceBlur}
            disabled={readonly}
            className={`${inputCls} h-7 w-24 text-right`}
          />
        </div>
        <span className="ml-auto text-sm font-semibold text-[var(--color-fg)] tabular-nums">
          {formatEUR(lineTotal)}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteLines({
  quoteId,
  initialLines,
  readonly = false,
}: {
  quoteId: string
  initialLines: QuoteLine[]
  readonly?: boolean
}) {
  const [lines, setLines] = useState<QuoteLine[]>(initialLines)
  const [, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor),
  )

  function scheduleSave(newLines: QuoteLine[]) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Only persist lines that have a description — empty lines are
      // kept in local state while the user is typing but must not be
      // sent to the server where the schema requires description.min(1).
      const linesToSave = newLines.filter((l) => l.description.trim() !== '')
      if (linesToSave.length === 0 && newLines.length > 0) return
      startTransition(() => {
        updateQuoteDraft(quoteId, { lines: linesToSave }).catch(() =>
          toast.error('Salvataggio righe fallito. Riprova.'),
        )
      })
    }, 400)
  }

  function handleUpdate(updated: QuoteLine) {
    const newLines = lines.map((l) => (l.id === updated.id ? updated : l))
    setLines(newLines)
    scheduleSave(newLines)
  }

  function handleDelete(id: string) {
    const newLines = lines.filter((l) => l.id !== id)
    setLines(newLines)
    scheduleSave(newLines)
  }

  function handleAdd() {
    const newLine: QuoteLine = {
      id: crypto.randomUUID(),
      description: '',
      qty: 1,
      unitPriceCents: 0,
    }
    const newLines = [...lines, newLine]
    setLines(newLines)
    scheduleSave(newLines)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = lines.findIndex((l) => l.id === active.id)
    const newIndex = lines.findIndex((l) => l.id === over.id)
    const newLines = arrayMove(lines, oldIndex, newIndex)
    setLines(newLines)
    scheduleSave(newLines)
  }

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0)

  return (
    <div className="space-y-2">
      <DndContext
        id="quote-lines-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={lines.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {lines.map((line) => (
              <SortableLine
                key={line.id}
                line={line}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                readonly={readonly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {lines.length === 0 && !readonly && (
        <p className="text-sm text-[var(--color-fg-faint)] text-center py-6">
          Nessuna riga. Aggiungi la prima prestazione.
        </p>
      )}

      {/* Add button */}
      {!readonly && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline mt-1 py-1"
        >
          <Plus size={14} />
          Aggiungi riga
        </button>
      )}

      {/* Subtotal */}
      {lines.length > 0 && (
        <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
          <div className="text-sm text-[var(--color-fg-muted)]">
            Subtotale{' '}
            <span className="font-semibold text-[var(--color-fg)] ml-3 tabular-nums">
              {formatEUR(subtotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
