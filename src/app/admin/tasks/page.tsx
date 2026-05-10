import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import Link from 'next/link'
import type { Task } from '@/lib/domain/types'
import { CreateTaskForm } from './CreateTaskForm'

const STATE_STYLES: Record<Task['state'], string> = {
  todo: 'bg-zinc-700 text-zinc-300',
  doing: 'bg-blue-900 text-blue-300',
  done: 'bg-green-900 text-green-300',
  cancelled: 'bg-zinc-800 text-zinc-500 line-through',
}

function formatTs(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(ts.toDate())
}

export default async function TasksPage() {
  await requireAdmin()

  const [openTasks, services, runbooks] = await Promise.all([
    tasksRepo.listOpen(),
    servicesRepo.list({ limit: 200 }),
    runbooksRepo.list({ limit: 100 }),
  ])

  const serviceMap = new Map(services.map((s) => [s.id, s.name]))
  const runbookMap = new Map(runbooks.map((r) => [r.id, r.title]))

  const todo = openTasks.filter((t) => t.state === 'todo')
  const doing = openTasks.filter((t) => t.state === 'doing')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
      </div>

      {/* Quick create */}
      <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Create task</h2>
        <CreateTaskForm services={services} runbooks={runbooks} />
      </section>

      {/* In progress */}
      {doing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            In progress ({doing.length})
          </h2>
          <TaskList tasks={doing} serviceMap={serviceMap} runbookMap={runbookMap} />
        </section>
      )}

      {/* To do */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          To do ({todo.length})
        </h2>
        {todo.length === 0 ? (
          <p className="text-zinc-500 text-sm">No open tasks.</p>
        ) : (
          <TaskList tasks={todo} serviceMap={serviceMap} runbookMap={runbookMap} />
        )}
      </section>
    </div>
  )
}

function TaskList({
  tasks,
  serviceMap,
  runbookMap,
}: {
  tasks: Task[]
  serviceMap: Map<string, string>
  runbookMap: Map<string, string>
}) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <Link
          key={t.id}
          href={`/admin/tasks/${t.id}`}
          className="block bg-zinc-800/60 border border-zinc-700 rounded-xl px-5 py-3.5 hover:border-zinc-500 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="font-medium text-white">{t.title}</p>
              {t.description && (
                <p className="text-xs text-zinc-400 line-clamp-1">{t.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-zinc-500">
                {t.serviceId && <span>Service: {serviceMap.get(t.serviceId) ?? t.serviceId}</span>}
                {t.runbookId && <span>Runbook: {runbookMap.get(t.runbookId) ?? t.runbookId}</span>}
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
