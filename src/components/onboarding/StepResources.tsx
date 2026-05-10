'use client'

import { useState } from 'react'
import { useWizard, type WizardResource } from '@/lib/onboarding/state'

const INPUT =
  'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const RESOURCE_KINDS = [
  'docker-host', 'k8s-cluster', 'db', 'dns-zone', 'ssl-cert',
  'domain', 'repo', 'firebase-project', 'vps', 'other',
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
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
        className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
      >
        + Add resource
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-md p-3 space-y-3 border border-zinc-700">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind *">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT}>
            <option value="">— select —</option>
            {RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="prod-postgres"
            className={INPUT}
          />
        </Field>
      </div>
      <Field label="Metadata (JSON, optional)">
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
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200"
        >
          Cancel
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
        <h2 className="text-xl font-bold text-white">Resources & dependencies</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Optionally link infrastructure resources to this service. You can skip this and add resources later.
        </p>
      </div>

      {state.resources.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">No resources added yet.</p>
      ) : (
        <div className="space-y-2">
          {state.resources.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-zinc-900 rounded-md px-3 py-2 border border-zinc-700"
            >
              <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {r.kind}
              </span>
              <span className="flex-1 text-sm text-zinc-200">{r.name}</span>
              {r.metadata && (
                <span className="text-xs text-zinc-500 font-mono truncate max-w-[180px]">
                  {r.metadata}
                </span>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_RESOURCE', index: i })}
                className="text-zinc-500 hover:text-red-400 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <AddResourceForm onAdd={(r) => dispatch({ type: 'ADD_RESOURCE', resource: r })} />

      <div className="border-t border-zinc-700 pt-4">
        <p className="text-xs text-zinc-500">
          Dependency edges (e.g. this service routes-to a database) can be added from the service detail page after onboarding.
        </p>
      </div>
    </div>
  )
}
