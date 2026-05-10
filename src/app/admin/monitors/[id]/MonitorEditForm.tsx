'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMonitor, toggleMonitor, deleteMonitor } from '../actions'

const MONITOR_SOURCES = [
  { value: 'internal-http', label: 'HTTP check (is the site up?)' },
  { value: 'internal-ssl', label: 'SSL certificate expiry' },
  { value: 'internal-dns', label: 'DNS records' },
  { value: 'internal-domain', label: 'Domain expiry (requires WHOIS API key)' },
] as const

/** Plain-object subset of Monitor — safe to pass from Server to Client Component */
export type MonitorData = {
  id: string
  source: string
  active: boolean
  lastResult?: string | null
  config: {
    url?: string
    intervalSec: number
    timeoutMs: number
    expectStatus?: number
    expectBody?: string
  }
  alertChannels: {
    telegram: boolean
    email: boolean
    clientNotify: boolean
  }
}

type Props = { monitor: MonitorData; serviceName: string }

export function MonitorEditForm({ monitor, serviceName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [source, setSource] = useState(monitor.source)
  const [url, setUrl] = useState(monitor.config.url ?? '')
  const [intervalSec, setIntervalSec] = useState(monitor.config.intervalSec ?? 300)
  const [timeoutMs, setTimeoutMs] = useState(monitor.config.timeoutMs ?? 10000)
  const [expectStatus, setExpectStatus] = useState(monitor.config.expectStatus ?? '')
  const [expectBody, setExpectBody] = useState(monitor.config.expectBody ?? '')
  const [alertTelegram, setAlertTelegram] = useState(monitor.alertChannels.telegram)
  const [alertEmail, setAlertEmail] = useState(monitor.alertChannels.email)
  const [alertClient, setAlertClient] = useState(monitor.alertChannels.clientNotify)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await updateMonitor(monitor.id, {
          source: source as 'internal-http' | 'internal-ssl' | 'internal-dns' | 'internal-domain',
          config: {
            url: url.trim() || undefined,
            intervalSec: Number(intervalSec),
            timeoutMs: Number(timeoutMs),
            expectStatus: expectStatus !== '' ? Number(expectStatus) : undefined,
            expectBody: expectBody.trim() || undefined,
          },
          alertChannels: {
            telegram: alertTelegram,
            email: alertEmail,
            clientNotify: alertClient,
          },
        })
        router.push(`/admin/monitors/${monitor.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleToggle() {
    startToggle(async () => {
      await toggleMonitor(monitor.id, !monitor.active)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('Delete this monitor permanently?')) return
    startDelete(async () => {
      await deleteMonitor(monitor.id)
    })
  }

  const inputCls = 'input-base'
  const labelCls = 'block text-sm text-gray-600 mb-1'

  return (
    <div className="space-y-8">
      {/* Meta info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400">Source</p>
          <p className="font-medium capitalize">{monitor.source.replace(/-/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Service</p>
          <p className="font-medium">{serviceName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Last result</p>
          <p className={`font-medium ${monitor.lastResult === 'up' ? 'text-green-600' : monitor.lastResult === 'down' ? 'text-red-600' : 'text-gray-400'}`}>
            {monitor.lastResult ?? 'pending'}
          </p>
        </div>
      </div>

      {/* Toggle active */}
      <div className="flex items-center gap-4">
        <span className={`text-sm font-medium ${monitor.active ? 'text-green-600' : 'text-gray-400'}`}>
          {monitor.active ? 'Active' : 'Paused'}
        </span>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggling}
          className="btn-secondary text-sm px-4 py-1.5"
        >
          {isToggling ? '…' : monitor.active ? 'Pause' : 'Activate'}
        </button>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source */}
        <div>
          <label className={labelCls}>Monitor type</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
            {MONITOR_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {source === 'internal-domain' && (
            <p className="mt-1 text-xs text-amber-600">Requires the <code>whois-api-key</code> secret in Secret Manager.</p>
          )}
        </div>

        {/* URL */}
        <div>
          <label className={labelCls}>URL</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className={inputCls} />
        </div>

        {/* Interval / Timeout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Interval (seconds)</label>
            <input type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} min={30} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Timeout (ms)</label>
            <input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} min={1000} className={inputCls} />
          </div>
        </div>

        {/* Expect status / body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Expected HTTP status</label>
            <input type="number" value={expectStatus} onChange={(e) => setExpectStatus(e.target.value)} placeholder="200" min={100} max={599} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expected body fragment</label>
            <input type="text" value={expectBody} onChange={(e) => setExpectBody(e.target.value)} placeholder="OK" className={inputCls} />
          </div>
        </div>

        {/* Alert channels */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-700 mb-2">Alert channels</legend>
          {[
            { label: 'Telegram', value: alertTelegram, set: setAlertTelegram },
            { label: 'Email', value: alertEmail, set: setAlertEmail },
            { label: 'Notify client', value: alertClient, set: setAlertClient },
          ].map(({ label, value, set }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit" disabled={isPending} className="btn-primary px-6 py-2.5">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={() => router.push('/admin/monitors')} className="btn-secondary px-6 py-2.5">
            Cancel
          </button>
        </div>
      </form>

      {/* Danger zone */}
      <div className="border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-500 mb-3">Danger zone</p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn-danger text-sm"
        >
          {isDeleting ? 'Deleting…' : 'Delete monitor'}
        </button>
      </div>
    </div>
  )
}
