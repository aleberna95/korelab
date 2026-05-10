'use client'

import { useState } from 'react'
import { useWizard, type WizardResource } from '@/lib/onboarding/state'

const INPUT =
  'input-base'

const RESOURCE_KINDS = [
  'docker-host', 'k8s-cluster', 'db', 'dns-zone', 'ssl-cert',
  'domain', 'repo', 'firebase-project', 'vps', 'other',
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

function AddResourceForm({ onAdd }: { onAdd: (r: WizardResource) => void }) {
  const [kind, setKind] = useState('')
  const [name, setName] = useState('')
  const [metadata, setMetadata] = useState('')
  const [open, setOpen] = useState(false)

  function submit() {
    if (!kind || !name.trim()) return
    onAdd({ kind, name: name.trim(), metadata })
    setKind(''); setName(''); setMetadata('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Aggiungi risorsa
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-md p-3 space-y-3 border border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo *">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT}>
            <option value="">— select —</option>
            {RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Nome *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="prod-postgres"
            className={INPUT}
          />
        </Field>
      </div>
        <Field label="Metadata (JSON, opzionale)">
        <input
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          placeholder='{"host": "10.0.0.5", "port": 5432}'
          className={`${INPUT} font-mono text-xs`}
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md"
        >
          Aggiungi
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          Annulla
        </button>
      </div>
    </div>
  )
}

export function StepResources() {
  const { state, dispatch } = useWizard()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Risorse e dipendenze</h2>
        <p className="text-sm text-gray-500 mt-1">
          Collega opzionalmente risorse infrastrutturali a questo servizio. Puoi saltare questo passaggio e aggiungere risorse in seguito.
        </p>
      </div>

      {state.resources.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Nessuna risorsa aggiunta.</p>
      ) : (
        <div className="space-y-2">
          {state.resources.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-50 rounded-md px-3 py-2 border border-gray-200"
            >
              <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                {r.kind}
              </span>
              <span className="flex-1 text-sm text-gray-800">{r.name}</span>
              {r.metadata && (
                <span className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
                  {r.metadata}
                </span>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_RESOURCE', index: i })}
                className="text-gray-500 hover:text-red-400 text-xs"
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      )}

      <AddResourceForm onAdd={(r) => dispatch({ type: 'ADD_RESOURCE', resource: r })} />

      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400">
          I bordi di dipendenza (es. questo servizio instrada verso un database) possono essere aggiunti dalla pagina di dettaglio del servizio dopo l'onboarding.
        </p>
      </div>
    </div>
  )
}
