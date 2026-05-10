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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <label className="text-sm text-gray-600">Visibility</label>
      <select
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as Report['visibility'])}
        className="input-base sm:w-auto"
      >
        <option value="private">private (admin only)</option>
        <option value="tokenized">tokenized (shared via token)</option>
        <option value="email">email (sent to client)</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {saved && <span className="text-xs text-green-600">Saved</span>}
    </form>
  )
}
