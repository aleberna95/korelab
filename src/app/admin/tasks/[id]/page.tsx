import { requireAdmin } from '@/lib/auth/guards'
import { tasksRepo } from '@/lib/repos/tasksRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TaskStateButtons } from './TaskStateButtons'
import { TaskNoteForm } from './TaskNoteForm'
import type { Task } from '@/lib/domain/types'

const STATE_STYLES: Record<Task['state'], string> = {
  todo: 'bg-zinc-700 text-zinc-300',
  doing: 'bg-blue-900 text-blue-300',
  done: 'bg-green-900 text-green-300',
  cancelled: 'bg-zinc-800 text-zinc-500',
}

function fmt(ts: { toDate(): Date } | undefined) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(ts.toDate())
}

type Props = { params: Promise<{ id: string }> }

export default async function TaskDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const task = await tasksRepo.getById(id)
  if (!task) notFound()

  const [service, runbook, incident] = await Promise.all([
    task.serviceId ? servicesRepo.getById(task.serviceId) : null,
    task.runbookId ? runbooksRepo.getById(task.runbookId) : null,
    task.incidentId ? incidentsRepo.getById(task.incidentId) : null,
  ])

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/admin/tasks" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Tasks
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <h1 className="text-2xl font-bold flex-1">{task.title}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full mt-1 ${STATE_STYLES[task.state]}`}>
            {task.state}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-zinc-300 text-sm">{task.description}</p>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {service && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Service</p>
            <Link href={`/admin/services/${service.id}`} className="text-blue-400 hover:underline">
              {service.name}
            </Link>
          </div>
        )}
        {incident && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Incident</p>
            <Link href={`/admin/incidents/${incident.id}`} className="text-blue-400 hover:underline">
              {incident.title}
            </Link>
          </div>
        )}
        {runbook && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Runbook</p>
            <Link href={`/admin/runbooks/${runbook.id}`} className="text-blue-400 hover:underline">
              {runbook.title}
            </Link>
            {task.runbookStepIndex !== undefined && (
              <span className="text-zinc-500 text-xs ml-2">
                step {task.runbookStepIndex + 1}
              </span>
            )}
          </div>
        )}
        {task.dueAt && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Due</p>
            <p>{fmt(task.dueAt as unknown as { toDate(): Date })}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Created</p>
          <p className="text-zinc-400">{fmt(task.createdAt as unknown as { toDate(): Date })}</p>
        </div>
        {task.completedAt && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Completed</p>
            <p className="text-zinc-400">{fmt(task.completedAt as unknown as { toDate(): Date })}</p>
          </div>
        )}
      </div>

      {/* State transitions */}
      {task.state !== 'done' && task.state !== 'cancelled' && (
        <section className="space-y-3 border-t border-zinc-700 pt-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Actions</h2>
          <TaskStateButtons taskId={task.id} currentState={task.state} />
        </section>
      )}

      {/* Notes */}
      <section className="space-y-3 border-t border-zinc-700 pt-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Notes</h2>
        <TaskNoteForm taskId={task.id} currentNotes={task.notes} />
      </section>
    </div>
  )
}
