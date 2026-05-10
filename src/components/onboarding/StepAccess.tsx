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
  { value: 'none', label: 'None — no access' },
  { value: 'read-only', label: 'Read-only' },
  { value: 'operational', label: 'Operational' },
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
        <h2 className="text-xl font-bold text-white">Access</h2>
        <p className="text-sm text-zinc-400 mt-1">
          How much access do you have to this service? Link credentials by Secret Manager reference — never paste actual values here.
        </p>
      </div>

      <Field label="Access level">
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

      <Field label="Providers / tools (comma-separated)" hint="e.g. Cloudflare, cPanel, GitHub, Vercel">
        <input
          value={a.providers}
          onChange={(e) => patch({ providers: e.target.value })}
          placeholder="Cloudflare, Vercel, GitHub"
          className={INPUT}
        />
      </Field>

      <Field
        label="Secret Manager references (one per line)"
        hint="Format: projects/{project}/secrets/{name}/versions/{version}"
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
            {invalidRefs.length} invalid reference(s) — check format.
          </p>
        )}
      </Field>

      <Field label="Access notes">
        <textarea
          value={a.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={2}
          placeholder="e.g. SSH key only on the ops machine; contact CTO for admin panel"
          className={INPUT}
        />
      </Field>
    </div>
  )
}
