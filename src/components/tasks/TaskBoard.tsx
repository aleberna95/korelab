'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { TaskColor } from '@/lib/domain/types'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import { updateTask, deleteTask, reorderTask } from '@/app/admin/tasks/actions'
import { TaskCard } from './TaskCard'
import { QuickCapture } from './QuickCapture'

type Props = {
  initialTasks: SerializedTask[]
}

export function TaskBoard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<SerializedTask[]>(initialTasks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [, startTransition] = useTransition()

  // Pending deletes (for undo)
  const pendingDeletes = useRef(
    new Map<string, { task: SerializedTask; timer: ReturnType<typeof setTimeout> }>(),
  )

  // Subscribe to realtime snapshot — merges with temp tasks
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    import('@/lib/repos/tasksSnapshot').then(({ onTasksSnapshot }) => {
      unsubscribe = onTasksSnapshot((incoming) => {
        setTasks((prev) => {
          // Keep temp tasks (optimistic creates not yet confirmed) that aren't in snapshot
          const incomingIds = new Set(incoming.map((t) => t.id))
          const tempTasks = prev.filter(
            (t) => t.id.startsWith('temp-') && !incomingIds.has(t.id),
          )
          return [...incoming, ...tempTasks].sort((a, b) => b.order - a.order)
        })
      })
    })
    return () => unsubscribe?.()
  }, [])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ─── Derived state ─────────────────────────────────────────────────────────
  const activeTasks = tasks.filter((t) => !t.done).sort((a, b) => b.order - a.order)
  const doneTasks = tasks.filter((t) => t.done).sort((a, b) => b.order - a.order)
  const maxOrder = activeTasks[0]?.order ?? 0

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleCreated(task: SerializedTask) {
    setTasks((prev) => {
      // If it's a real ID replacing a temp, swap it; otherwise just add
      if (!task.id.startsWith('temp-')) {
        // Remove the most recent temp task (the one we're replacing)
        const tempIdx = prev.findIndex((t) => t.id.startsWith('temp-') && t.order === task.order)
        if (tempIdx >= 0) {
          const next = [...prev]
          next[tempIdx] = task
          return next.sort((a, b) => b.order - a.order)
        }
      }
      const exists = prev.some((t) => t.id === task.id)
      if (exists) return prev
      return [task, ...prev].sort((a, b) => b.order - a.order)
    })
  }

  function handleUpdate(id: string, text: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)))
    setEditingId(null)
    if (id.startsWith('temp-')) return
    startTransition(async () => {
      try {
        await updateTask(id, { text })
      } catch {
        toast.error('Errore nel salvataggio')
      }
    })
  }

  function handleColorChange(id: string, color: TaskColor) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)))
    if (id.startsWith('temp-')) return
    startTransition(async () => {
      await updateTask(id, { color })
    })
  }

  function handleDone(id: string, done: boolean) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done, doneAtMs: done ? Date.now() : undefined } : t,
      ),
    )
    if (id.startsWith('temp-')) return
    startTransition(async () => {
      await updateTask(id, { done })
    })
  }

  function handleDelete(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return

    // Remove optimistically
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (id.startsWith('temp-')) return

    const timer = setTimeout(() => {
      pendingDeletes.current.delete(id)
      startTransition(() => deleteTask(id))
    }, 5000)

    pendingDeletes.current.set(id, { task, timer })

    toast(`"${task.text.slice(0, 40)}" eliminata`, {
      duration: 5000,
      action: {
        label: 'Annulla',
        onClick: () => {
          const pending = pendingDeletes.current.get(id)
          if (pending) {
            clearTimeout(pending.timer)
            pendingDeletes.current.delete(id)
            setTasks((prev) => [...prev, pending.task].sort((a, b) => b.order - a.order))
          }
        },
      },
    })
  }

  function handleClearDone() {
    const doneIds = doneTasks.map((t) => t.id)
    setTasks((prev) => prev.filter((t) => !t.done))
    startTransition(async () => {
      await Promise.all(doneIds.filter((id) => !id.startsWith('temp-')).map(deleteTask))
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return

    const oldIndex = activeTasks.findIndex((t) => t.id === active.id)
    const newIndex = activeTasks.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const newArr = arrayMove(activeTasks, oldIndex, newIndex)

    // Compute new order based on neighbours (sorted desc: higher order = higher position)
    const above = newArr[newIndex - 1]?.order
    const below = newArr[newIndex + 1]?.order
    let newOrder: number
    if (above !== undefined && below !== undefined) {
      newOrder = Math.round((above + below) / 2)
    } else if (above !== undefined) {
      newOrder = above - 1000
    } else if (below !== undefined) {
      newOrder = below + 1000
    } else {
      newOrder = 0
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, order: newOrder } : t)),
    )

    if (!String(active.id).startsWith('temp-')) {
      startTransition(async () => {
        await reorderTask(String(active.id), newOrder)
      })
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* QuickCapture — sticky top */}
      <div className="sticky top-0 z-10 pb-1" style={{ background: 'var(--color-bg)' }}>
        <QuickCapture maxOrder={maxOrder} onCreated={handleCreated} />
      </div>

      {/* Active tasks grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
          {activeTasks.length === 0 ? (
            <p className="py-10 text-center text-[var(--color-fg-faint)] text-sm">
              🌱 Nessuna nota. Aggiungine una sopra.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isEditing={editingId === task.id}
                  dimmed={editingId !== null && editingId !== task.id}
                  onStartEdit={() => setEditingId(task.id)}
                  onSave={handleUpdate}
                  onDelete={handleDelete}
                  onDone={handleDone}
                  onColorChange={handleColorChange}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {/* Done section */}
      {(doneTasks.length > 0 || showDone) && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] mb-3 w-full"
          >
            <span
              className={`transition-transform ${showDone ? '' : '-rotate-90'}`}
            >
              ▾
            </span>
            <span>Fatte ({doneTasks.length})</span>
            {showDone && doneTasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearDone()
                }}
                className="ml-auto text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] text-xs"
              >
                Pulisci
              </button>
            )}
          </button>

          {showDone && doneTasks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {doneTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isEditing={false}
                  dimmed={false}
                  onStartEdit={() => handleDone(task.id, false)}
                  onSave={handleUpdate}
                  onDelete={handleDelete}
                  onDone={handleDone}
                  onColorChange={handleColorChange}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
