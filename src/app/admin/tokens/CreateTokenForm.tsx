'use client'

import { useState, useTransition } from 'react'
import { createStatusToken } from './actions'
import type { StatusToken } from '@/lib/domain/types'

type Props = {
  clients: { id: string; name: string }[]
  services: { id: string; name: string }[]
}

const ALL_SECTIONS: StatusToken['allowedSections'][number][] = ['status', 'incidents', 'maintenance', 'reports']

export function CreateTokenForm({ clients, services }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [scope, setScope] = useState<StatusToken['scope']>('service')
  const [targetId, setTargetId] = useState(services[0]?.id ?? '')
  const [sections, setSections] = useState<Set<string>>(new Set(['status', 'incidents', 'maintenance']))
  const [expiresAt, setExpiresAt] = useState('')

  function toggleSection(s: string) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreatedToken(null)

    if (!targetId) { setError('Select a target'); return }
    if (sections.size === 0) { setError('Select at least one section'); return }

    startTransition(async () => {
      try {
        const result = await createStatusToken({
          scope,
          targetId,
          allowedSections: [...sections] as StatusToken['allowedSections'],
          expiresAt: expiresAt ? `${expiresAt}T23:59:59.999Z` : undefined,
        })
        const url = `${window.location.origin}/s/${result.rawToken}`
        setCreatedToken(result.rawToken)
        setCreatedUrl(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create token')
      }
    })
  }

  async function handleCopy() {
    if (!createdUrl) return
    await navigator.clipboard.writeText(createdUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (createdToken && createdUrl) {
    return (
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-green-800 mb-2">
            Token created — copy the URL below. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-100 rounded px-2 py-1 break-all text-gray-800">
              {createdUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary shrink-0 text-xs px-3 py-1.5"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setCreatedToken(null); setCreatedUrl(null) }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Create another token
        </button>
      </div>
    )
  }

  const options = scope === 'service' ? services : clients

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Scope */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600">Scope</label>
        <div className="flex gap-3">
          {(['service', 'client'] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value={s}
                checked={scope === s}
                onChange={() => {
                  setScope(s)
                  setTargetId(s === 'service' ? (services[0]?.id ?? '') : (clients[0]?.id ?? ''))
                }}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      {/* Target */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {scope === 'service' ? 'Service' : 'Client'} *
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="input-base"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Expires (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="input-base"
          />
        </div>
      </div>

      {/* Sections */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">Allowed sections *</label>
        <div className="flex gap-4 flex-wrap">
          {ALL_SECTIONS.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sections.has(s)}
                onChange={() => toggleSection(s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary"
      >
        {isPending ? 'Creating…' : 'Create token'}
      </button>
    </form>
  )
}
