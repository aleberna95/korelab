'use client'

import { useState, useTransition } from 'react'
import { updateReportVisibility } from './actions'
import type { Report } from '@/lib/domain/types'

type Props = {
  reportId: string
  current: Report['visibility']
}

export function ReportVisibilityForm({ reportId, current }: Props) {
  const [visibility, setVisibility] = useState<Report['visibility']>(current)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    startTransition(async () => {
      await updateReportVisibility(reportId, visibility)
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <label className="text-sm text-zinc-400">Visibility</label>
      <select
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as Report['visibility'])}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="private">private (admin only)</option>
        <option value="tokenized">tokenized (shared via token)</option>
        <option value="email">email (sent to client)</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {saved && <span className="text-xs text-green-400">Saved</span>}
    </form>
  )
}
