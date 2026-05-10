'use client'

import { useTransition } from 'react'
import { deleteRunbook } from '../../actions'

type Props = { runbookId: string }

export function DeleteRunbookButton({ runbookId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Delete this runbook permanently? This cannot be undone.')) return
    startTransition(async () => {
      await deleteRunbook(runbookId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      {isPending ? 'Deleting…' : 'Delete runbook'}
    </button>
  )
}
