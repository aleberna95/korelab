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
        className="input-base resize-y"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="btn-secondary"
        >
          {isPending ? 'Saving…' : 'Save notes'}
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </form>
  )
}
