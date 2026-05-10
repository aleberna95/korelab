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
  { value: 'private', label: 'Privato — solo interno' },
  { value: 'tokenized', label: 'Tokenizzato — condiviso via URL segreto' },
  { value: 'public', label: 'Pubblico — visibile a tutti' },
]

const REPORT_SHARING_OPTIONS = [
  { value: 'private', label: 'Privato — solo interno' },
  { value: 'tokenized', label: 'Tokenizzato — condiviso via URL segreto' },
  { value: 'email', label: 'Email — inviato direttamente al cliente' },
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
        <h2 className="text-xl font-bold text-white">Visibilità</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Controlla chi può vedere la pagina di stato e i report per questo servizio.
        </p>
      </div>

      <Field
        label="Pagina di stato"
        hint="Privato: solo admin. Tokenizzato: viene generato un URL segreto. Pubblico: visibile a chiunque."
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
        label="Condivisione report"
        hint="Come i report mensili vengono condivisi con il cliente."
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
