'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateReport } from './actions'
import type { Service, Client } from '@/lib/domain/types'

type Props = {
  services: Service[]
  clients: Client[]
}

export function GenerateReportForm({ services, clients }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Default: previous month
  const now = new Date()
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59))
  const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1))

  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [from, setFrom] = useState(prevMonthStart.toISOString().slice(0, 10))
  const [to, setTo] = useState(prevMonthEnd.toISOString().slice(0, 10))
  const [label, setLabel] = useState(() => {
    return prevMonthStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  })
  const [clientNotes, setClientNotes] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'tokenized' | 'email'>('private')

  const selectedService = services.find((s) => s.id === serviceId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!serviceId) { setError('Select a service'); return }
    if (!from || !to) { setError('Set date range'); return }
    if (from > to) { setError('From must be before to'); return }

    startTransition(async () => {
      try {
        const reportId = await generateReport({
          serviceId,
          clientId: selectedService!.clientId,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          label: label.trim() || `${from} → ${to}`,
          clientNotes,
          privateNotes,
          visibility,
        })
        router.push(`/admin/reports/${reportId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate report')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Service */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Service *</label>
        <select
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value)
          }}
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        >
          {services.map((s) => {
            const clientName = clients.find((c) => c.id === s.clientId)?.name ?? s.clientId
            return (
              <option key={s.id} value={s.id}>
                {s.name} ({clientName})
              </option>
            )
          })}
        </select>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">From *</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">To *</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Label */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Period label *</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. May 2026"
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Visibility</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="private">private (admin only)</option>
          <option value="tokenized">tokenized (share via token)</option>
          <option value="email">email (send to client)</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Client notes</label>
        <textarea
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          rows={3}
          placeholder="Visible to client in the tokenized report…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-y"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Private notes</label>
        <textarea
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          rows={2}
          placeholder="Admin only…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-y"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
      >
        {isPending ? 'Generating…' : 'Generate report'}
      </button>
    </form>
  )
}
