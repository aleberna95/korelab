'use client'

import { useState, useTransition } from 'react'
import { updateTask } from '../actions'

type Props = {
  taskId: string
  currentNotes: string
}

export function TaskNoteForm({ taskId, currentNotes }: Props) {
  const [notes, setNotes] = useState(currentNotes)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    startTransition(async () => {
      await updateTask(taskId, { notes })
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Add notes…"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-y"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg"
        >
          {isPending ? 'Saving…' : 'Save notes'}
        </button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
      </div>
    </form>
  )
}
