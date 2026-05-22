'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import { toMarkdown, toCsv, downloadFile } from '@/lib/tasks/export'
import { TaskCard } from './TaskCard'
import { QuickCapture } from './QuickCapture'
import type { LinkItem } from './TaskLinkSheet'

type Props = {
  initialTasks: SerializedTask[]
  availableClients?: LinkItem[]
  availableServices?: LinkItem[]
}

export function TaskBoard({ initialTasks, availableClients = [], availableServices = [] }: Props) {
  const [tasks, setTasks] = useState<SerializedTask[]>(initialTasks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportIncludeDone, setExportIncludeDone] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [stickyH, setStickyH] = useState(64)
  const [, startTransition] = useTransition()

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem('korelab:tasks:collapsed', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Load collapsed state from localStorage after mount (avoid hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('korelab:tasks:collapsed')
      if (stored) setCollapsed(new Set(JSON.parse(stored) as string[]))
    } catch {}
  }, [])

  // Measure sticky container height for dynamic section header offset
  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    setStickyH(el.offsetHeight)
    const ro = new ResizeObserver(() => setStickyH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    function onDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showExportMenu])

  function buildLookups() {
    return {
      clients: new Map(availableClients.map((c) => [c.id, c.name])),
      services: new Map(availableServices.map((s) => [s.id, s.name])),
    }
  }

  function handleExportMarkdown() {
    const md = toMarkdown(tasks, buildLookups(), exportIncludeDone)
    downloadFile(`korelab-note-${today()}.md`, 'text/markdown;charset=utf-8', md)
    setShowExportMenu(false)
  }

  function handleExportCsv() {
    const csv = toCsv(tasks, buildLookups(), exportIncludeDone)
    downloadFile(`korelab-note-${today()}.csv`, 'text/csv;charset=utf-8', csv)
    setShowExportMenu(false)
  }

  function today() {
    return new Date().toISOString().slice(0, 10)
  }

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
          // Keep temp tasks whose order hasn't been confirmed yet by a real task
          const incomingOrders = new Set(incoming.map((t) => t.order))
          const tempTasks = prev.filter(
            (t) => t.id.startsWith('temp-') && !incomingOrders.has(t.order),
          )
          // Exclude tasks that are in the pending-delete undo window (still in Firestore but removed locally)
          const pendingIds = new Set(pendingDeletes.current.keys())
          const filtered = incoming.filter((t) => !pendingIds.has(t.id))
          return [...filtered, ...tempTasks].sort((a, b) => b.order - a.order)
        })
      })
    })
    return () => unsubscribe?.()
  }, [])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ─── Derived state ─────────────────────────────────────────────────────────
  const activeTasks = tasks.filter((t) => !t.done).sort((a, b) => b.order - a.order)
  const doneTasks = tasks.filter((t) => t.done).sort((a, b) => b.order - a.order)
  const maxOrder = activeTasks[0]?.order ?? 0

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleCreated(task: SerializedTask) {
    setTasks((prev) => {
      if (!task.id.startsWith('temp-')) {
        // Real task already arrived via snapshot — just purge orphaned temp
        if (prev.some((t) => t.id === task.id)) {
          return prev
            .filter((t) => !(t.id.startsWith('temp-') && t.order === task.order))
            .sort((a, b) => b.order - a.order)
        }
        // Replace matching temp
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
    if (!window.confirm(`Eliminare definitivamente ${doneTasks.length} note fatte? Questa azione non è reversibile.`)) return
    const doneIds = doneTasks.map((t) => t.id)
    setTasks((prev) => prev.filter((t) => !t.done))
    startTransition(async () => {
      await Promise.all(doneIds.filter((id) => !id.startsWith('temp-')).map(deleteTask))
    })
  }

  function handleLinkChange(id: string, clientIds: string[], serviceIds: string[]) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, clientIds, serviceIds } : t)))
    if (id.startsWith('temp-')) return
    startTransition(async () => {
      await updateTask(id, { clientIds, serviceIds })
    })
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    // Recompute groups to find which section this drag belongs to
    const live = tasks.filter((t) => !t.done).sort((a, b) => b.order - a.order)
    const incorsoGroup = live.filter((t) => !t.clientIds.length)
    const byClientMap = new Map<string, SerializedTask[]>()
    for (const t of live) for (const cid of t.clientIds) {
      if (!byClientMap.has(cid)) byClientMap.set(cid, [])
      byClientMap.get(cid)!.push(t)
    }

    // Find the group that contains both active and over
    let groupTasks: SerializedTask[] | null = null
    const aid = String(active.id)
    const oid = String(over.id)
    if (incorsoGroup.some((t) => t.id === aid) && incorsoGroup.some((t) => t.id === oid)) {
      groupTasks = incorsoGroup
    } else {
      for (const [, gTasks] of byClientMap) {
        if (gTasks.some((t) => t.id === aid) && gTasks.some((t) => t.id === oid)) {
          groupTasks = gTasks
          break
        }
      }
    }
    if (!groupTasks) return // cross-section drop → ignore

    const oldIndex = groupTasks.findIndex((t) => t.id === aid)
    const newIndex = groupTasks.findIndex((t) => t.id === oid)
    const newArr = arrayMove(groupTasks, oldIndex, newIndex)

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

    setTasks((prev) => prev.map((t) => (t.id === aid ? { ...t, order: newOrder } : t)))
    navigator.vibrate?.(10)

    if (!aid.startsWith('temp-')) {
      startTransition(async () => { await reorderTask(aid, newOrder) })
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  const clientsById = new Map(availableClients.map((c) => [c.id, c.name]))

  // Groups
  const inCorso = activeTasks.filter((t) => !t.clientIds.length)
  const byClient = new Map<string, SerializedTask[]>()
  for (const t of activeTasks) for (const cid of t.clientIds) {
    if (!byClient.has(cid)) byClient.set(cid, [])
    byClient.get(cid)!.push(t)
  }

  // Shared card props helper
  function cardProps(task: SerializedTask) {
    return {
      task,
      isEditing: editingId === task.id,
      dimmed: editingId !== null && editingId !== task.id,
      availableClients,
      availableServices,
      onStartEdit: () => setEditingId(task.id),
      onSave: handleUpdate,
      onDelete: handleDelete,
      onDone: handleDone,
      onColorChange: handleColorChange,
      onLinkChange: handleLinkChange,
    }
  }

  function SectionHeader({ label, count, sectionKey }: { label: string; count: number; sectionKey: string }) {
    const isCollapsed = collapsed.has(sectionKey)
    return (
      <button
        type="button"
        onClick={() => toggleCollapsed(sectionKey)}
        className="sticky z-[5] flex items-center gap-2 w-full py-2 px-0 text-left"
        style={{ background: 'var(--color-bg)', top: stickyH }}
      >
        <span className={`text-[var(--color-fg-faint)] text-xs transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
        <span className="font-semibold text-[var(--color-fg)] text-[15px] flex-1 truncate">{label}</span>
        <span className="text-[13px] text-[var(--color-fg-faint)] shrink-0">{count}</span>
      </button>
    )
  }

  function TaskGrid({ groupTasks, sectionKey }: { groupTasks: SerializedTask[]; sectionKey: string }) {
    if (collapsed.has(sectionKey)) return null
    return (
      <SortableContext items={groupTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
          {groupTasks.map((task) => (
            <TaskCard key={task.id} {...cardProps(task)} />
          ))}
        </div>
      </SortableContext>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-1">
      {/* QuickCapture + export — sticky top */}
      <div ref={stickyRef} className="sticky top-0 z-10 pb-2" style={{ background: 'var(--color-bg)' }}>
        <QuickCapture
          maxOrder={maxOrder}
          onCreated={handleCreated}
          availableClients={availableClients}
          availableServices={availableServices}
        />
        <div className="relative flex justify-end mt-1" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setShowExportMenu((v) => !v)}
            className="text-xs px-2.5 py-1 rounded flex items-center gap-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
          >
            ⬇ Esporta
          </button>
          {showExportMenu && (
            <div className="absolute top-7 right-0 w-56 bg-[var(--card)] rounded-[var(--radius)] border border-[var(--color-border)] shadow-lg py-1 z-[20]">
              <label className="flex items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-accent-soft)] select-none">
                <input
                  type="checkbox"
                  checked={exportIncludeDone}
                  onChange={(e) => setExportIncludeDone(e.target.checked)}
                  className="accent-[var(--color-accent)] w-4 h-4"
                />
                Includi fatte
              </label>
              <div className="h-px bg-[var(--color-border)] mx-2 my-1" />
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-accent-soft)] transition-colors"
              >
                📄 Markdown
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-accent-soft)] transition-colors"
              >
                📊 CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter chip bar — navigates to sections */}
      {(inCorso.length > 0 || byClient.size > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {inCorso.length > 0 && (
            <button
              type="button"
              onClick={() => document.getElementById('section-incorso')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="shrink-0 px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] transition-colors"
            >
              In corso
            </button>
          )}
          {[...byClient.entries()].map(([cid]) => (
            <button
              key={cid}
              type="button"
              onClick={() => document.getElementById(`section-client-${cid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="shrink-0 px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] transition-colors"
            >
              👤 {clientsById.get(cid) ?? cid}
            </button>
          ))}
        </div>
      )}

      <DndContext id="task-board" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* ── In corso ── */}
        {(inCorso.length > 0 || activeTasks.length === 0) && (
          <section id="section-incorso" style={{ scrollMarginTop: stickyH + 8 }}>
            <SectionHeader label="In corso" count={inCorso.length} sectionKey="__incorso__" />
            {inCorso.length === 0 && !collapsed.has('__incorso__') ? (
              <p className="py-8 text-center text-[var(--color-fg-faint)] text-sm">
                Cosa ti gira per la testa? Scrivilo sopra ↑
              </p>
            ) : (
              <TaskGrid groupTasks={inCorso} sectionKey="__incorso__" />
            )}
          </section>
        )}

        {/* ── Gruppi per cliente ── */}
        {[...byClient.entries()].map(([clientId, groupTasks]) => {
          const clientName = clientsById.get(clientId) ?? clientId
          const sectionKey = `client:${clientId}`
          return (
            <section key={clientId} id={`section-client-${clientId}`} className="mt-2" style={{ scrollMarginTop: stickyH + 8 }}>
              <SectionHeader label={`👤 ${clientName}`} count={groupTasks.length} sectionKey={sectionKey} />
              <TaskGrid groupTasks={groupTasks} sectionKey={sectionKey} />
            </section>
          )
        })}

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {activeId ? (
            <TaskCard
              task={activeTasks.find((t) => t.id === activeId)!}
              isEditing={false}
              dimmed={false}
              overlay
              onStartEdit={() => {}}
              onSave={() => {}}
              onDelete={() => {}}
              onDone={() => {}}
              onColorChange={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Fatte ── */}
      {doneTasks.length > 0 && (
        <section className="mt-2">
          <div className="flex items-center gap-2 w-full py-2 px-0">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <span className={`text-[var(--color-fg-faint)] text-xs transition-transform ${showDone ? '' : '-rotate-90'}`}>▾</span>
              <span className="font-semibold text-[var(--color-fg-muted)] text-[15px]">Fatte</span>
              <span className="text-[13px] text-[var(--color-fg-faint)]">{doneTasks.length}</span>
            </button>
            {showDone && (
              <button
                type="button"
                onClick={handleClearDone}
                className="text-[11px] text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] shrink-0"
              >
                Pulisci
              </button>
            )}
          </div>
          {showDone && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
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
