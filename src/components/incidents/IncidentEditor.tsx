'use client'

import { useState } from 'react'
import type { Incident, IncidentState, IncidentSeverity } from '@/lib/domain/types'
import { canTransition } from '@/lib/incidents/transitions'

type Props = {
  incident: Incident
  onSaved?: () => void
}

const ALL_STATES: IncidentState[] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'false-positive',
]
const ALL_SEVERITIES: IncidentSeverity[] = ['minor', 'major', 'critical']

export function IncidentEditor({ incident, onSaved }: Props) {
  const [state, setState] = useState(incident.state)
  const [severity, setSeverity] = useState(incident.severity)
  const [title, setTitle] = useState(incident.title)
  const [privateMessage, setPrivateMessage] = useState(incident.privateMessage ?? '')
  const [rootCause, setRootCause] = useState(incident.rootCause ?? '')
  const [resolution, setResolution] = useState(incident.resolution ?? '')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowedStates = ALL_STATES.filter(
    (s) => s === incident.state || canTransition(incident.state, s),
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          severity,
          title,
          privateMessage,
          rootCause,
          resolution,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setComment('')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Row 1: state + severity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stato</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as IncidentState)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {allowedStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gravità</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Titolo</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Private message */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Note private</label>
        <textarea
          value={privateMessage}
          onChange={(e) => setPrivateMessage(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Root cause + resolution */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Causa radice</label>
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Risoluzione</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Aggiungi commento alla cronologia
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Commento opzionale per la cronologia…"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>

        {/* Quick actions */}
        {canTransition(incident.state, 'false-positive') && (
          <button
            onClick={() => {
              setState('false-positive')
              setComment('Marcato come falso positivo')
            }}
            disabled={saving}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Segna come falso positivo
          </button>
        )}
        {canTransition(incident.state, 'resolved') && incident.state !== 'resolved' && (
          <button
            onClick={() => {
              setState('resolved')
              setComment('Chiuso manualmente dall\'admin')
            }}
            disabled={saving}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Chiudi incidente
          </button>
        )}
      </div>
    </div>
  )
}
