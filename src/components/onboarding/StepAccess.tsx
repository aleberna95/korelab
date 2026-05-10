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

const ACCESS_LEVELS = [
  { value: 'none', label: 'Nessuno — nessun accesso' },
  { value: 'read-only', label: 'Solo lettura' },
  { value: 'operational', label: 'Operativo' },
  { value: 'admin', label: 'Admin' },
]

const SM_REF_PATTERN = /^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/

export function StepAccess() {
  const { state, dispatch } = useWizard()
  const a = state.access

  function patch(p: Partial<typeof a>) {
    dispatch({ type: 'UPDATE_ACCESS', patch: p })
  }

  // Validate Secret Manager refs
  const invalidRefs = a.secretManagerRefs
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => !SM_REF_PATTERN.test(r))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Accesso</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Quant'accesso hai a questo servizio? Collega le credenziali tramite riferimento Secret Manager — non incollare mai i valori reali qui.
        </p>
      </div>

      <Field label="Livello di accesso">
        <select
          value={a.level}
          onChange={(e) => patch({ level: e.target.value })}
          className={INPUT}
        >
          {ACCESS_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Provider / strumenti (separati da virgola)" hint="es. Cloudflare, cPanel, GitHub, Vercel">
        <input
          value={a.providers}
          onChange={(e) => patch({ providers: e.target.value })}
          placeholder="Cloudflare, Vercel, GitHub"
          className={INPUT}
        />
      </Field>

      <Field
        label="Riferimenti Secret Manager (uno per riga)"
        hint="Formato: projects/{project}/secrets/{name}/versions/{version}"
      >
        <textarea
          value={a.secretManagerRefs}
          onChange={(e) => patch({ secretManagerRefs: e.target.value })}
          rows={4}
          placeholder={'projects/korelab-cc/secrets/acme-ssh-key/versions/latest\nprojects/korelab-cc/secrets/acme-db-pass/versions/1'}
          className={`${INPUT} font-mono text-xs`}
          spellCheck={false}
        />
        {invalidRefs.length > 0 && (
          <p className="text-xs text-amber-400 mt-1">
            {invalidRefs.length} riferimento/i non valido/i — controlla il formato.
          </p>
        )}
      </Field>

      <Field label="Note di accesso">
        <textarea
          value={a.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={2}
          placeholder="es. Chiave SSH solo sulla macchina ops; contattare il CTO per il pannello admin"
          className={INPUT}
        />
      </Field>
    </div>
  )
}
