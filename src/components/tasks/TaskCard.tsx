'use client'

import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskColor } from '@/lib/domain/types'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TASK_COLORS: TaskColor[] = [
  'yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray',
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  task: SerializedTask
  isEditing: boolean
  dimmed: boolean
  onStartEdit: () => void
  onSave: (id: string, text: string) => void
  onDelete: (id: string) => void
  onDone: (id: string, done: boolean) => void
  onColorChange: (id: string, color: TaskColor) => void
}

// ─── Grip icon ────────────────────────────────────────────────────────────────

function GripDots() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[0, 6, 12].map((y) =>
        [0, 6].map((x) => <circle key={`${x}-${y}`} cx={x + 2} cy={y + 2} r="1.5" />),
      )}
    </svg>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

export function TaskCard({
  task,
  isEditing,
  dimmed,
  onStartEdit,
  onSave,
  onDelete,
  onDone,
  onColorChange,
}: Props) {
  const [localText, setLocalText] = useState(task.text)
  const [showMenu, setShowMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Drag setup — activator on grip handle only
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  // Touch tracking for swipe + long-press
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchMoved = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [swipeX, setSwipeX] = useState(0)

  // Keep local text in sync when external edits arrive
  useEffect(() => {
    if (!isEditing) setLocalText(task.text)
  }, [task.text, isEditing])

  // Auto-focus + auto-resize textarea on edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      autoResize(el)
    }
  }, [isEditing])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function commitSave() {
    const trimmed = localText.trim()
    if (!trimmed) {
      onDelete(task.id)
    } else {
      onSave(task.id, trimmed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      commitSave()
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitSave()
    }
  }

  // Touch handlers: long-press + swipe
  function handleTouchStart(e: React.TouchEvent) {
    if (isEditing) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchMoved.current = false
    setSwipeX(0)
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        setShowMenu(true)
        navigator.vibrate?.(10)
      }
    }, 500)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      touchMoved.current = true
      clearTimeout(longPressTimer.current)
    }
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      setSwipeX(Math.min(80, Math.max(-80, dx * 0.5)))
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    clearTimeout(longPressTimer.current)
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    setSwipeX(0)

    // Tap (no movement, no menu shown)
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !showMenu) {
      e.preventDefault() // prevent subsequent synthetic click
      onStartEdit()
      return
    }

    // Swipe right → done toggle
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onDone(task.id, !task.done)
      navigator.vibrate?.(20)
      return
    }

    // Swipe left → delete
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onDelete(task.id)
      return
    }
  }

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showMenu])

  const bgColor = task.done ? 'var(--color-task-gray)' : `var(--color-task-${task.color})`

  const cardStyle: React.CSSProperties = {
    background: bgColor,
    transform: `${CSS.Transform.toString(transform) ?? ''} translateX(${swipeX}px)`,
    transition: swipeX !== 0 ? 'none' : transition ?? undefined,
    opacity: isDragging ? 0.45 : dimmed ? 0.35 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      className="task-appear group/card relative rounded-[var(--radius-lg)] p-5 [box-shadow:var(--shadow-card)] touch-pan-y select-none"
    >
      {/* Drag grip handle — always visible on mobile, hover on desktop */}
      {!task.done && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 p-1 text-[var(--color-fg-faint)] cursor-grab active:cursor-grabbing opacity-50 md:opacity-0 md:group-hover/card:opacity-70 transition-opacity"
          aria-label="Trascina per riordinare"
          onClick={(e) => e.stopPropagation()}
        >
          <GripDots />
        </button>
      )}

      {/* Editing state */}
      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value)
              autoResize(e.target)
            }}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full bg-transparent resize-none outline-none font-medium leading-snug"
            style={{ fontSize: '16px', fontFamily: 'inherit', minHeight: '1.5em' }}
          />
          <p className="text-[11px] opacity-40 mt-2 select-none">Esc per salvare</p>
        </div>
      ) : (
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={onStartEdit}
          className="cursor-pointer"
        >
          <p
            className={`font-medium leading-snug whitespace-pre-wrap break-words text-[15px] ${
              task.done ? 'line-through opacity-50' : ''
            }`}
          >
            {task.text}
          </p>
        </div>
      )}

      {/* Long-press context menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 rounded-[var(--radius)] bg-[var(--color-surface)] [box-shadow:var(--shadow-pop)] p-3 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 mb-2.5">
            {TASK_COLORS.map((c) => (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                  task.color === c ? 'border-[var(--color-fg)]' : 'border-transparent'
                }`}
                style={{ background: `var(--color-task-${c})` }}
                onClick={() => {
                  onColorChange(task.id, c)
                  setShowMenu(false)
                }}
                aria-label={c}
              />
            ))}
          </div>
          <button
            className="text-[13px] text-[var(--color-danger)] hover:underline w-full text-left pt-1"
            onClick={() => {
              setShowMenu(false)
              onDelete(task.id)
            }}
          >
            Elimina
          </button>
        </div>
      )}
    </div>
  )
}
