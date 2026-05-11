'use client'

import { useState, useTransition } from 'react'
import { createMonitorForService } from '../actions'

const SOURCES = [
  { value: 'internal-http', label: 'HTTP — sito risponde?' },
  { value: 'internal-ssl', label: 'SSL — certificato valido?' },
] as const

type Props = { serviceId: string; clientId: string }

export function AddMonitorForm({ serviceId, clientId }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [source, setSource] = useState<string>('internal-http')
  const [url, setUrl] = useState('')
  const [intervalSec, setIntervalSec] = useState(300)
  const [expectStatus, setExpectStatus] = useState<number | ''>(200)
  const [expectBody, setExpectBody] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!url.trim()) { setError('URL obbligatorio'); return }

    startTransition(async () => {
      try {
        await createMonitorForService(serviceId, clientId, {
          source: source as 'internal-http' | 'internal-ssl',
          config: {
            url: url.trim(),
            intervalSec: Number(intervalSec),
            timeoutMs: 10000,
            expectStatus: expectStatus !== '' ? Number(expectStatus) : undefined,
            expectBody: expectBody.trim() || undefined,
          },
          alertChannels: { telegram: true, clientNotify: false },
          active: true,
        })
        setOpen(false)
        // reset
        setUrl(''); setSource('internal-http'); setIntervalSec(300); setExpectStatus(200); setExpectBody('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore')
      }
    })
  }

  const inputCls = 'input-base'
  const labelCls = 'block text-sm text-gray-600 mb-1'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors text-center"
      >
        + Aggiungi monitor
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 bg-gray-50 border-t border-gray-100">
      <div>
        <label className={labelCls}>Tipo di check</label>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>URL *</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className={inputCls}
        />
      </div>

      {source === 'internal-http' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Status atteso</label>
            <input
              type="number"
              value={expectStatus}
              onChange={(e) => setExpectStatus(e.target.value === '' ? '' : Number(e.target.value))}
              min={100} max={599}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Body fragment (opzionale)</label>
            <input type="text" value={expectBody} onChange={(e) => setExpectBody(e.target.value)} placeholder="OK" className={inputCls} />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Intervallo (secondi)</label>
        <input type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} min={30} className={inputCls} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary text-sm px-4 py-2">
          {isPending ? 'Salvataggio…' : 'Aggiungi'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm px-4 py-2">
          Annulla
        </button>
      </div>
    </form>
  )
}
