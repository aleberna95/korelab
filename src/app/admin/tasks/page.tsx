import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import type { SerializedTask } from '@/lib/repos/tasksSnapshot'

export const metadata: Metadata = { title: 'Note — KoreLab' }

/** Phase 24 — Lavagna Tasks */
export default async function TasksPage() {
  await requireAdmin()

  const tasks = await tasksRepo.listTasks()

  // Serialize Timestamps to plain numbers before passing to client component
  const initialTasks: SerializedTask[] = tasks.map((t) => ({
    id: t.id,
    text: t.text,
    color: t.color,
    order: t.order,
    done: t.done,
    doneAtMs: t.doneAt?.toMillis(),
    createdAtMs: t.createdAt.toMillis(),
    updatedAtMs: t.updatedAt.toMillis(),
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-2">
      <header className="flex items-center justify-between pb-2">
        <h1 className="text-h1">Note</h1>
        <span className="text-[13px]" style={{ color: 'var(--color-fg-faint)' }}>
          {tasks.filter((t) => !t.done).length}
        </span>
      </header>
      <TaskBoard initialTasks={initialTasks} />
    </div>
  )
}
