'use client'

import { useState, useTransition } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'
import type { TaskColor } from '@/lib/domain/types'
import type { LinkItem } from './TaskLinkSheet'
import { TaskCard } from './TaskCard'
import { createTask, updateTask, deleteTask } from '@/app/admin/tasks/actions'

type Props = {
  entityId: string
  entityType: 'client' | 'service'
  entityName: string
  initialTasks: SerializedTask[]
  availableClients?: LinkItem[]
  availableServices?: LinkItem[]
}

export function TaskInlineSection({
  entityId,
  entityType,
  entityName,
  initialTasks,
  availableClients = [],
  availableServices = [],
}: Props) {
  const [tasks, setTasks] = useState<SerializedTask[]>(initialTasks ?? [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [quickText, setQuickText] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [, startTransition] = useTransition()

  const activeTasks = tasks.filter((t) => !t.done).sort((a, b) => b.order - a.order)
  const doneTasks = tasks.filter((t) => t.done).sort((a, b) => b.order - a.order)
  const maxOrder = activeTasks[0]?.order ?? 0

  async function handleQuickAdd() {
    const trimmed = quickText.trim()
    if (!trimmed || isPending) return
    setIsPending(true)
    const order = maxOrder + 1000
    const tempId = `temp-${Date.now()}`
    const clientIds = entityType === 'client' ? [entityId] : []
    const serviceIds = entityType === 'service' ? [entityId] : []

    setTasks((prev) => [
      {
        id: tempId,
        text: trimmed,
        color: 'yellow' as TaskColor,
        order,
        done: false,
        clientIds,
        serviceIds,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      },
      ...prev,
    ])
    setQuickText('')

    try {
      const realId = await createTask({ text: trimmed, color: 'yellow', order, clientIds, serviceIds })
      setTasks((prev) => {
        if (prev.some((t) => t.id === realId)) return prev.filter((t) => t.id !== tempId)
        return prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t))
      })
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId))
    } finally {
      setIsPending(false)
    }
  }

  function handleUpdate(id: string, text: string) {
    if (!text.trim()) { handleDelete(id); return }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)))
    setEditingId(null)
    if (!id.startsWith('temp-')) startTransition(() => updateTask(id, { text }))
  }

  function handleDone(id: string, done: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
    if (!id.startsWith('temp-')) startTransition(() => updateTask(id, { done }))
  }

  function handleColorChange(id: string, color: TaskColor) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)))
    if (!id.startsWith('temp-')) startTransition(() => updateTask(id, { color }))
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (!id.startsWith('temp-')) startTransition(() => deleteTask(id))
  }

  function handleLinkChange(id: string, clientIds: string[], serviceIds: string[]) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, clientIds, serviceIds } : t)))
    if (!id.startsWith('temp-')) startTransition(() => updateTask(id, { clientIds, serviceIds }))
  }

  return (
    <section>
      <h2
        className="text-sm font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        Note
      </h2>

      {/* Quick add */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd() }}
          placeholder={`Aggiungi nota per ${entityName}…`}
          disabled={isPending}
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2.5 outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
          style={{ fontSize: '16px' }}
        />
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={!quickText.trim() || isPending}
          className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-medium text-sm disabled:opacity-40 shrink-0"
        >
          {isPending ? '…' : '+ Aggiungi'}
        </button>
      </div>

      {/* Active tasks */}
      {activeTasks.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-fg-faint)' }}>
          Nessuna nota. Aggiungine una sopra.
        </p>
      ) : (
        <DndContext onDragEnd={() => {}}>
          <SortableContext items={activeTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isEditing={editingId === task.id}
                  dimmed={editingId !== null && editingId !== task.id}
                  availableClients={availableClients}
                  availableServices={availableServices}
                  onStartEdit={() => setEditingId(task.id)}
                  onSave={handleUpdate}
                  onDelete={handleDelete}
                  onDone={handleDone}
                  onColorChange={handleColorChange}
                  onLinkChange={handleLinkChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-2 text-sm mb-2 w-full"
            style={{ color: 'var(--color-fg-muted)' }}
          >
            <span className={`text-xs transition-transform ${showDone ? '' : '-rotate-90'}`}>▾</span>
            <span>Fatte ({doneTasks.length})</span>
          </button>
          {showDone && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>
      )}
    </section>
  )
}
