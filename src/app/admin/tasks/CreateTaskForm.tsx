'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTask } from './actions'
import type { Service, Runbook } from '@/lib/domain/types'

type Props = {
  services: Service[]
  runbooks: Runbook[]
}

export function CreateTaskForm({ services, runbooks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [runbookId, setRunbookId] = useState('')
  const [dueAt, setDueAt] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('Title required'); return }

    startTransition(async () => {
      try {
        await createTask({
          title: title.trim(),
          description: description.trim(),
          serviceId: serviceId || undefined,
          runbookId: runbookId || undefined,
          dueAt: dueAt ? `${dueAt}T23:59:59.000Z` : undefined,
          state: 'todo',
          notes: '',
        })
        setTitle('')
        setDescription('')
        setServiceId('')
        setRunbookId('')
        setDueAt('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title *"
          required
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="col-span-3 sm:col-span-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Service —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={runbookId}
          onChange={(e) => setRunbookId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Runbook —</option>
          {runbooks.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-zinc-500 mr-2">Due date:</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}
