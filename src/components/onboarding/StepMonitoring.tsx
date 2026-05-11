'use client'

import { useWizard } from '@/lib/onboarding/state'

const INPUT =
  'input-base'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

const MONITOR_SOURCES = [
  { value: 'internal-http', label: 'Controllo HTTP' },
  { value: 'internal-ssl', label: 'Controllo SSL (scadenza certificato)' },
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
        <h2 className="text-xl font-bold text-white">Monitoraggio</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configura il monitor principale per questo servizio.
        </p>
      </div>

      <Field label="Sorgente monitor *">
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
        <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-xs text-gray-500">
          URL monitor (dal servizio): <span className="text-gray-800">{healthcheckUrl}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Intervallo controllo (secondi) *" hint="30–3600">
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

        <Field label="Stato HTTP atteso *">
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

      <Field label="Corpo risposta atteso (opzionale)" hint="Sottostringa che deve apparire nella risposta">
        <input
          value={m.expectBody}
          onChange={(e) => patch({ expectBody: e.target.value })}
          placeholder="OK"
          className={INPUT}
        />
      </Field>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Canali di allerta
        </label>
        {(
          [
            ['telegram', 'Telegram bot'],
            ['clientNotify', 'Notifica cliente direttamente'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={m[key]}
              onChange={(e) => patch({ [key]: e.target.checked })}
              className="accent-blue-600"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
