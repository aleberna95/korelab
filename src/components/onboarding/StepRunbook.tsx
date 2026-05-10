'use client'

import { useState } from 'react'
import {
  useWizard,
  type WizardCommonFailure,
  type WizardRecoveryStep,
} from '@/lib/onboarding/state'
import type { RunbookOption } from './WizardShell'

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

function AddFailureForm({ onAdd }: { onAdd: (f: WizardCommonFailure) => void }) {
  const [symptom, setSymptom] = useState('')
  const [cause, setCause] = useState('')
  const [fix, setFix] = useState('')
  const [open, setOpen] = useState(false)

  function submit() {
    if (!symptom.trim() || !fix.trim()) return
    onAdd({ symptom: symptom.trim(), likelyCause: cause.trim(), fix: fix.trim() })
    setSymptom(''); setCause(''); setFix('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
        + Add common failure
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-md p-3 space-y-2 border border-zinc-700">
      <Field label="Symptom *">
        <input value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="Site returns 502" className={INPUT} />
      </Field>
      <Field label="Likely cause">
        <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder="PHP-FPM crashed" className={INPUT} />
      </Field>
      <Field label="Fix *">
        <input value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Restart PHP-FPM: systemctl restart php-fpm" className={INPUT} />
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={submit} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
      </div>
    </div>
  )
}

function AddStepForm({ onAdd }: { onAdd: (s: WizardRecoveryStep) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('low')
  const [open, setOpen] = useState(false)

  function submit() {
    if (!title.trim() || !body.trim()) return
    onAdd({ title: title.trim(), body: body.trim(), riskLevel: risk })
    setTitle(''); setBody(''); setRisk('low')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
        + Add recovery step
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-md p-3 space-y-2 border border-zinc-700">
      <Field label="Step title *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Restart Nginx" className={INPUT} />
      </Field>
      <Field label="Instructions *">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="SSH in and run: systemctl restart nginx" className={INPUT} />
      </Field>
      <Field label="Risk level">
        <select value={risk} onChange={(e) => setRisk(e.target.value as 'low' | 'medium' | 'high')} className={INPUT}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={submit} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
      </div>
    </div>
  )
}

type Props = { runbookOptions: RunbookOption[] }

export function StepRunbook({ runbookOptions }: Props) {
  const { state, dispatch } = useWizard()
  const rb = state.runbook

  function patchRunbook(p: Partial<typeof rb>) {
    dispatch({ type: 'UPDATE_RUNBOOK', patch: p })
  }

  const RISK_BADGE: Record<string, string> = {
    low: 'bg-green-900/40 text-green-400',
    medium: 'bg-amber-900/40 text-amber-400',
    high: 'bg-red-900/40 text-red-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Runbook</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Attach a runbook so you know exactly what to do when this service has an incident.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3">
        {(['none', 'existing', 'new'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => dispatch({ type: 'SET_RUNBOOK_MODE', mode })}
            className={[
              'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
              state.runbookMode === mode
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white',
            ].join(' ')}
          >
            {mode === 'none' ? 'Skip' : mode === 'existing' ? 'Use existing' : 'Create new'}
          </button>
        ))}
      </div>

      {/* Existing runbook picker */}
      {state.runbookMode === 'existing' && (
        <Field label="Select runbook *">
          <select
            value={state.existingRunbookId}
            onChange={(e) => dispatch({ type: 'SET_EXISTING_RUNBOOK', id: e.target.value })}
            className={INPUT}
          >
            <option value="">— choose —</option>
            {runbookOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </Field>
      )}

      {/* New runbook form */}
      {state.runbookMode === 'new' && (
        <div className="space-y-5">
          <Field label="Runbook title *">
            <input
              value={rb.title}
              onChange={(e) => patchRunbook({ title: e.target.value })}
              placeholder="WordPress — Site Down"
              className={INPUT}
            />
          </Field>

          <Field label="First checks (one per line)" hint="Quick things to verify before digging deeper">
            <textarea
              value={rb.firstChecks}
              onChange={(e) => patchRunbook({ firstChecks: e.target.value })}
              rows={3}
              placeholder={"Check Cloudflare status\nSSH to server and check disk space\nCheck PHP-FPM logs"}
              className={INPUT}
            />
          </Field>

          <Field label="Contacts (one per line)" hint="Who to call when things go wrong">
            <textarea
              value={rb.contacts}
              onChange={(e) => patchRunbook({ contacts: e.target.value })}
              rows={2}
              placeholder={"Host support: +39 800 123 456\nDevOps: @devops-team on Slack"}
              className={INPUT}
            />
          </Field>

          {/* Common failures */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Common failures
            </label>
            {rb.commonFailures.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">None added yet.</p>
            ) : (
              rb.commonFailures.map((f, i) => (
                <div key={i} className="bg-zinc-900 rounded-md px-3 py-2 border border-zinc-700 text-sm space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-200 font-medium">{f.symptom}</span>
                    <button type="button" onClick={() => dispatch({ type: 'REMOVE_COMMON_FAILURE', index: i })} className="text-zinc-500 hover:text-red-400 text-xs">Remove</button>
                  </div>
                  {f.likelyCause && <p className="text-zinc-500 text-xs">Cause: {f.likelyCause}</p>}
                  <p className="text-zinc-400 text-xs">Fix: {f.fix}</p>
                </div>
              ))
            )}
            <AddFailureForm onAdd={(f) => dispatch({ type: 'ADD_COMMON_FAILURE', failure: f })} />
          </div>

          {/* Recovery steps */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Recovery steps (ordered)
            </label>
            {rb.recoverySteps.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">None added yet.</p>
            ) : (
              rb.recoverySteps.map((s, i) => (
                <div key={i} className="bg-zinc-900 rounded-md px-3 py-2 border border-zinc-700 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-zinc-400 text-xs mr-2">#{i + 1}</span>
                      <span className="text-zinc-200 font-medium">{s.title}</span>
                      <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${RISK_BADGE[s.riskLevel]}`}>
                        {s.riskLevel}
                      </span>
                    </div>
                    <button type="button" onClick={() => dispatch({ type: 'REMOVE_RECOVERY_STEP', index: i })} className="text-zinc-500 hover:text-red-400 text-xs">Remove</button>
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">{s.body}</p>
                </div>
              ))
            )}
            <AddStepForm onAdd={(s) => dispatch({ type: 'ADD_RECOVERY_STEP', step: s })} />
          </div>

          <Field label="Notes">
            <textarea
              value={rb.notes}
              onChange={(e) => patchRunbook({ notes: e.target.value })}
              rows={2}
              className={INPUT}
            />
          </Field>
        </div>
      )}

      {state.runbookMode === 'none' && (
        <p className="text-sm text-zinc-500 italic">
          No runbook will be attached. You can create one later from the Runbooks section.
        </p>
      )}
    </div>
  )
}
