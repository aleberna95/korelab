'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTask } from './actions'

type Props = {
  services: { id: string; name: string }[]
}

export function CreateTaskForm({ services }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [serviceId, setServiceId] = useState('')
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
          dueAt: dueAt ? `${dueAt}T23:59:59.000Z` : undefined,
          state: 'todo',
          notes: '',
        })
        setTitle('')
        setDescription('')
        setServiceId('')
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
          className="input-base flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary shrink-0"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="input-base col-span-1 sm:col-span-1"
        />
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="input-base"
        >
          <option value="">— Service —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 mr-2">Due date:</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="input-base sm:w-auto"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
