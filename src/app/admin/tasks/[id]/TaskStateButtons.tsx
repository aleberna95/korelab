'use client'

import { useTransition } from 'react'
import { updateTask } from '../actions'
import type { Task } from '@/lib/domain/types'

type Props = {
  taskId: string
  currentState: Task['state']
}

const TRANSITIONS: Record<Task['state'], Array<{ label: string; state: Task['state']; color: string }>> = {
  todo: [
    { label: 'Start', state: 'doing', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Cancel', state: 'cancelled', color: 'bg-zinc-700 hover:bg-zinc-600' },
  ],
  doing: [
    { label: 'Mark done', state: 'done', color: 'bg-green-700 hover:bg-green-600' },
    { label: 'Back to todo', state: 'todo', color: 'bg-zinc-700 hover:bg-zinc-600' },
    { label: 'Cancel', state: 'cancelled', color: 'bg-zinc-700 hover:bg-zinc-600' },
  ],
  done: [],
  cancelled: [],
}

export function TaskStateButtons({ taskId, currentState }: Props) {
  const [isPending, startTransition] = useTransition()

  const actions = TRANSITIONS[currentState] ?? []
  if (actions.length === 0) return null

  function transition(state: Task['state']) {
    startTransition(async () => {
      await updateTask(taskId, { state })
    })
  }

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <button
          key={a.state}
          onClick={() => transition(a.state)}
          disabled={isPending}
          className={`text-sm text-white px-4 py-2 rounded-lg disabled:opacity-50 ${a.color}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
