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

const STATUS_PAGE_OPTIONS = [
  { value: 'private', label: 'Private — internal only' },
  { value: 'tokenized', label: 'Tokenized — shared via secret URL' },
  { value: 'public', label: 'Public — visible to everyone' },
]

const REPORT_SHARING_OPTIONS = [
  { value: 'private', label: 'Private — internal only' },
  { value: 'tokenized', label: 'Tokenized — shared via secret URL' },
  { value: 'email', label: 'Email — sent directly to client' },
]

export function StepVisibility() {
  const { state, dispatch } = useWizard()
  const v = state.visibility

  function patch(p: Partial<typeof v>) {
    dispatch({ type: 'UPDATE_VISIBILITY', patch: p })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Visibility</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Control who can see the status page and reports for this service.
        </p>
      </div>

      <Field
        label="Status page"
        hint="Private: admin-only. Tokenized: a secret URL is generated. Public: visible to anyone."
      >
        <div className="space-y-2 mt-1">
          {STATUS_PAGE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="statusPage"
                value={opt.value}
                checked={v.statusPage === opt.value}
                onChange={() => patch({ statusPage: opt.value })}
                className="mt-0.5 accent-indigo-500"
              />
              <div>
                <span className="text-sm text-zinc-200">{opt.label}</span>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Report sharing"
        hint="How monthly reports are shared with the client."
      >
        <div className="space-y-2 mt-1">
          {REPORT_SHARING_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="reportSharing"
                value={opt.value}
                checked={v.reportSharing === opt.value}
                onChange={() => patch({ reportSharing: opt.value })}
                className="mt-0.5 accent-indigo-500"
              />
              <div>
                <span className="text-sm text-zinc-200">{opt.label}</span>
              </div>
            </label>
          ))}
        </div>
      </Field>
    </div>
  )
}
