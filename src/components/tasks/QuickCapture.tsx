'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { TaskColor } from '@/lib/domain/types'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import { TASK_COLORS } from './TaskCard'
import { TaskLinkSheet, type LinkItem } from './TaskLinkSheet'
import { TaskLinkChips } from './TaskLinkChips'
import { createTask } from '@/app/admin/tasks/actions'

const LAST_COLOR_KEY = 'korelab:task-color'

const MAX_ROWS = 3
const LINE_HEIGHT = 24 // px, matches text-[16px] leading-snug

type Props = {
  maxOrder: number
  onCreated: (task: SerializedTask) => void
  availableClients?: LinkItem[]
  availableServices?: LinkItem[]
}

export function QuickCapture({ maxOrder, onCreated, availableClients = [], availableServices = [] }: Props) {
  const [text, setText] = useState('')
  const [color, setColor] = useState<TaskColor>('yellow')
  const [showColors, setShowColors] = useState(false)
  const [showLinkSheet, setShowLinkSheet] = useState(false)
  const [linkClientIds, setLinkClientIds] = useState<string[]>([])
  const [linkServiceIds, setLinkServiceIds] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const colorsRef = useRef<HTMLDivElement>(null)

  // Restore last used color
  useEffect(() => {
    const last = localStorage.getItem(LAST_COLOR_KEY) as TaskColor | null
    if (last && (TASK_COLORS as string[]).includes(last)) setColor(last)
  }, [])

  // Auto-focus on desktop only (fine pointer = mouse/stylus, not touch)
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      textareaRef.current?.focus()
    }
  }, [])

  // Close color picker on outside click
  useEffect(() => {
    if (!showColors) return
    function handler(e: MouseEvent) {
      if (colorsRef.current && !colorsRef.current.contains(e.target as Node)) {
        setShowColors(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showColors])

  // Auto-resize textarea up to MAX_ROWS
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16 // +16 for padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [])

  useEffect(() => {
    autoResize()
  }, [text, autoResize])

  async function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || isPending) return

    setIsPending(true)
    navigator.vibrate?.(10)
    const order = maxOrder + 1000
    const tempId = `temp-${Date.now()}`

    // Optimistic add with temp ID
    onCreated({
      id: tempId,
      text: trimmed,
      color,
      order,
      done: false,
      clientIds: linkClientIds,
      serviceIds: linkServiceIds,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    })

    setText('')
    setLinkClientIds([])
    setLinkServiceIds([])
    localStorage.setItem(LAST_COLOR_KEY, color)

    try {
      const realId = await createTask({ text: trimmed, color, order, clientIds: linkClientIds, serviceIds: linkServiceIds })
      // Swap temp → real ID in board
      onCreated({
        id: realId,
        text: trimmed,
        color,
        order,
        done: false,
        clientIds: linkClientIds,
        serviceIds: linkServiceIds,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      })
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setIsPending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setText('')
      textareaRef.current?.blur()
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 rounded-[var(--radius)] bg-[var(--card)] [box-shadow:var(--shadow-card)]">
        {/* ✏️ hint icon */}
        <span className="text-[var(--color-fg-faint)] text-base shrink-0" aria-hidden>
          ✏️
        </span>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize() }}
          onKeyDown={handleKeyDown}
          placeholder="Cosa devi fare?"
          rows={1}
          disabled={isPending}
          className="flex-1 bg-transparent resize-none outline-none font-medium leading-snug placeholder:text-[var(--color-fg-faint)] disabled:opacity-50 overflow-hidden min-w-0"
          style={{ fontSize: '16px', fontFamily: 'inherit' }}
        />

        {/* Pulisci button — only when text present */}
        {text.trim() && (
          <button
            type="button"
            onClick={() => { setText(''); textareaRef.current?.focus() }}
            className="text-[var(--color-fg-faint)] hover:text-[var(--color-fg)] text-xs shrink-0"
            aria-label="Cancella"
          >
            Pulisci
          </button>
        )}

        {/* Submit */}
        {text.trim() && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-[var(--color-accent)] font-medium text-base shrink-0 disabled:opacity-50"
            aria-label="Crea nota"
          >
            {isPending ? '…' : '↵'}
          </button>
        )}

        {/* Link button */}
        {(availableClients.length > 0 || availableServices.length > 0) && (
          <button
            type="button"
            onClick={() => setShowLinkSheet(true)}
            className={`shrink-0 text-base transition-opacity ${
              linkClientIds.length + linkServiceIds.length > 0
                ? 'opacity-100'
                : 'opacity-40 hover:opacity-70'
            }`}
            aria-label="Collega a cliente / servizio"
          >
            🔗
          </button>
        )}

        {/* Color chip — right side */}
        <div className="relative shrink-0" ref={colorsRef}>
          <button
            type="button"
            className="w-7 h-7 rounded-full border-2 border-[var(--color-border)] transition-transform hover:scale-110 active:scale-95"
            style={{ background: `var(--color-task-${color})` }}
            onClick={() => setShowColors((v) => !v)}
            aria-label="Colore nota"
          />
          {showColors && (
            <div className="absolute bottom-full right-0 mb-2 flex gap-1.5 bg-[var(--color-surface)] rounded-[var(--radius-sm)] p-2 [box-shadow:var(--shadow-pop)] z-50">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                    c === color ? 'border-[var(--color-fg)] scale-110' : 'border-transparent'
                  }`}
                  style={{ background: `var(--color-task-${c})` }}
                  onClick={() => {
                    setColor(c)
                    setShowColors(false)
                    textareaRef.current?.focus()
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
        </div>

        {/* Link chips preview */}
        {(linkClientIds.length > 0 || linkServiceIds.length > 0) && (
          <div className="w-full pt-1">
            <TaskLinkChips
              clientIds={linkClientIds}
              serviceIds={linkServiceIds}
              availableClients={availableClients}
              availableServices={availableServices}
              onRemoveClient={(id) => setLinkClientIds((prev) => prev.filter((x) => x !== id))}
              onRemoveService={(id) => setLinkServiceIds((prev) => prev.filter((x) => x !== id))}
            />
          </div>
        )}
      </div>

      {showLinkSheet && (
        <TaskLinkSheet
          initialClientIds={linkClientIds}
          initialServiceIds={linkServiceIds}
          availableClients={availableClients}
          availableServices={availableServices}
          onSubmit={(cIds, sIds) => { setLinkClientIds(cIds); setLinkServiceIds(sIds) }}
          onClose={() => setShowLinkSheet(false)}
        />
      )}
    </>
  )
}

