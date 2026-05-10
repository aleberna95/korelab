'use client'

import { useWizard } from '@/lib/onboarding/state'

const INPUT =
  'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

const MONITOR_SOURCES = [
  { value: 'internal-http', label: 'Internal HTTP check' },
  { value: 'internal-ssl', label: 'Internal SSL check' },
  { value: 'internal-dns', label: 'Internal DNS check' },
  { value: 'internal-domain', label: 'Internal domain check' },
  { value: 'uptimerobot', label: 'UptimeRobot (synced)' },
]

export function StepMonitoring() {
  const { state, dispatch } = useWizard()
  const m = state.monitor

  function patch(p: Partial<typeof m>) {
    dispatch({ type: 'UPDATE_MONITOR', patch: p })
  }

  const healthcheckUrl = state.service.healthcheckUrl || state.service.primaryUrl

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Monitoring</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Configure the primary monitor for this service.
        </p>
      </div>

      <Field label="Monitor source *">
        <select
          value={m.source}
          onChange={(e) => patch({ source: e.target.value })}
          className={INPUT}
        >
          {MONITOR_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      {healthcheckUrl && (
        <div className="px-3 py-2 bg-zinc-900 rounded-md border border-zinc-700 text-xs text-zinc-400">
          Monitor URL (from service): <span className="text-zinc-200">{healthcheckUrl}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Check interval (seconds) *" hint="30–3600">
          <input
            type="number"
            min={30}
            max={3600}
            step={30}
            value={m.intervalSec}
            onChange={(e) => patch({ intervalSec: Number(e.target.value) })}
            className={INPUT}
          />
        </Field>

        <Field label="Expected HTTP status *">
          <input
            type="number"
            min={100}
            max={599}
            value={m.expectStatus}
            onChange={(e) => patch({ expectStatus: Number(e.target.value) })}
            className={INPUT}
          />
        </Field>
      </div>

      <Field label="Expected response body (optional)" hint="Substring that must appear in the response">
        <input
          value={m.expectBody}
          onChange={(e) => patch({ expectBody: e.target.value })}
          placeholder="OK"
          className={INPUT}
        />
      </Field>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Alert channels
        </label>
        {(
          [
            ['telegram', 'Telegram bot'],
            ['email', 'Email'],
            ['clientNotify', 'Notify client directly'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={m[key]}
              onChange={(e) => patch({ [key]: e.target.checked })}
              className="accent-indigo-500"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
