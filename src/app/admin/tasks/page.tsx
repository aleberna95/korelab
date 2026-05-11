import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import Link from 'next/link'
import type { Task } from '@/lib/domain/types'
import { CreateTaskForm } from './CreateTaskForm'

const STATE_STYLES: Record<Task['state'], string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-400 line-through',
}

function formatTs(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(ts.toDate())
}

export default async function TasksPage() {
  await requireAdmin()

  const [openTasks, services] = await Promise.all([
    tasksRepo.listOpen(),
    servicesRepo.list({ limit: 200 }),
  ])

  const serviceMap = new Map<string, string>(services.map((s) => [s.id, s.name]))

  const todo = openTasks.filter((t) => t.state === 'todo')
  const doing = openTasks.filter((t) => t.state === 'doing')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tasks</h1>
      </div>

      {/* Quick create */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Create task</h2>
        <CreateTaskForm
          services={services.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      {/* In progress */}
      {doing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            In progress ({doing.length})
          </h2>
          <TaskList tasks={doing} serviceMap={serviceMap} />
        </section>
      )}

      {/* To do */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          To do ({todo.length})
        </h2>
        {todo.length === 0 ? (
          <p className="text-gray-500 text-sm">No open tasks.</p>
        ) : (
          <TaskList tasks={todo} serviceMap={serviceMap} />
        )}
      </section>
    </div>
  )
}

function TaskList({
  tasks,
  serviceMap,
}: {
  tasks: Task[]
  serviceMap: Map<string, string>
}) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <Link
          key={t.id}
          href={`/admin/tasks/${t.id}`}
          className="block bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="font-medium text-gray-900">{t.title}</p>
              {t.description && (
                <p className="text-xs text-gray-500 line-clamp-1">{t.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-400">
                {t.serviceId && <span>Service: {serviceMap.get(t.serviceId) ?? t.serviceId}</span>}
                {t.dueAt && <span>Due {formatTs(t.dueAt as unknown as { toDate(): Date })}</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATE_STYLES[t.state]}`}>
              {t.state}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
