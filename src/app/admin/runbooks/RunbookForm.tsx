'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRunbook, updateRunbook } from './actions'
import type { Runbook } from '@/lib/domain/types'
import type { CreateRunbookInput } from '@/lib/domain/schemas/runbook'

type RecoveryStep = CreateRunbookInput['recoverySteps'][number]
type CommonFailure = CreateRunbookInput['commonFailures'][number]

type Props = {
  /** If provided, editing an existing runbook */
  runbook?: Runbook
}

export function RunbookForm({ runbook }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Basic fields
  const [title, setTitle] = useState(runbook?.title ?? '')
  const [notes, setNotes] = useState(runbook?.notes ?? '')
  const [serviceTypes, setServiceTypes] = useState(runbook?.serviceTypes.join(', ') ?? '')
  const [tags, setTags] = useState(runbook?.appliesToTags.join(', ') ?? '')
  const [contacts, setContacts] = useState(runbook?.contacts.join('\n') ?? '')
  const [links, setLinks] = useState(runbook?.links.join('\n') ?? '')
  const [firstChecks, setFirstChecks] = useState(runbook?.firstChecks.join('\n') ?? '')

  // Dynamic arrays
  const [steps, setSteps] = useState<RecoveryStep[]>(
    runbook?.recoverySteps ?? [],
  )
  const [failures, setFailures] = useState<CommonFailure[]>(
    runbook?.commonFailures ?? [],
  )

  function splitLines(s: string): string[] {
    return s.split('\n').map((l) => l.trim()).filter(Boolean)
  }
  function splitComma(s: string): string[] {
    return s.split(',').map((l) => l.trim()).filter(Boolean)
  }

  // ─── Steps helpers ──────────────────────────────────────────────────────
  function addStep() {
    setSteps([...steps, { title: '', body: '', riskLevel: 'low' }])
  }
  function updateStep(i: number, field: keyof RecoveryStep, value: string) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i))
  }

  // ─── Failures helpers ────────────────────────────────────────────────────
  function addFailure() {
    setFailures([...failures, { symptom: '', likelyCause: '', fix: '' }])
  }
  function updateFailure(i: number, field: keyof CommonFailure, value: string) {
    setFailures(failures.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }
  function removeFailure(i: number) {
    setFailures(failures.filter((_, idx) => idx !== i))
  }

  function buildInput(): CreateRunbookInput {
    return {
      title: title.trim(),
      notes: notes.trim(),
      serviceTypes: splitComma(serviceTypes),
      appliesToTags: splitComma(tags),
      contacts: splitLines(contacts),
      links: splitLines(links),
      firstChecks: splitLines(firstChecks),
      recoverySteps: steps.filter((s) => s.title.trim()),
      commonFailures: failures.filter((f) => f.symptom.trim()),
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('Title required'); return }

    startTransition(async () => {
      try {
        if (runbook) {
          await updateRunbook(runbook.id, buildInput())
          router.push(`/admin/runbooks/${runbook.id}`)
        } else {
          const id = await createRunbook(buildInput())
          router.push(`/admin/runbooks/${id}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm'
  const labelCls = 'block text-sm text-zinc-400 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className={labelCls}>Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-y`} />
      </div>

      {/* Service types + tags */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Service types (comma-separated)</label>
          <input type="text" value={serviceTypes} onChange={(e) => setServiceTypes(e.target.value)} placeholder="static-site, node-app" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tags (comma-separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ecommerce, auth" className={inputCls} />
        </div>
      </div>

      {/* First checks */}
      <div>
        <label className={labelCls}>First checks (one per line)</label>
        <textarea value={firstChecks} onChange={(e) => setFirstChecks(e.target.value)} rows={3} placeholder={'Check Cloudflare status\nCheck server CPU'} className={`${inputCls} resize-y`} />
      </div>

      {/* Common failures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Common failures</h3>
          <button type="button" onClick={addFailure} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
        </div>
        {failures.map((f, i) => (
          <div key={i} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-400">Failure {i + 1}</p>
              <button type="button" onClick={() => removeFailure(i)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
            <input type="text" value={f.symptom} onChange={(e) => updateFailure(i, 'symptom', e.target.value)} placeholder="Symptom *" className={inputCls} />
            <input type="text" value={f.likelyCause} onChange={(e) => updateFailure(i, 'likelyCause', e.target.value)} placeholder="Likely cause" className={inputCls} />
            <input type="text" value={f.fix} onChange={(e) => updateFailure(i, 'fix', e.target.value)} placeholder="Fix" className={inputCls} />
          </div>
        ))}
      </div>

      {/* Recovery steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Recovery steps</h3>
          <button type="button" onClick={addStep} className="text-xs text-blue-400 hover:text-blue-300">+ Add step</button>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-400">Step {i + 1}</p>
              <button type="button" onClick={() => removeStep(i)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={step.title} onChange={(e) => updateStep(i, 'title', e.target.value)} placeholder="Title *" className={`${inputCls} col-span-2`} />
              <select value={step.riskLevel} onChange={(e) => updateStep(i, 'riskLevel', e.target.value)} className={inputCls}>
                <option value="low">low risk</option>
                <option value="medium">medium risk</option>
                <option value="high">high risk</option>
              </select>
            </div>
            <textarea value={step.body} onChange={(e) => updateStep(i, 'body', e.target.value)} placeholder="Step instructions…" rows={3} className={`${inputCls} resize-y`} />
          </div>
        ))}
      </div>

      {/* Contacts + links */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contacts (one per line)</label>
          <textarea value={contacts} onChange={(e) => setContacts(e.target.value)} rows={3} placeholder="John Doe — john@example.com" className={`${inputCls} resize-y`} />
        </div>
        <div>
          <label className={labelCls}>Links (one URL per line)</label>
          <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={3} placeholder="https://docs.example.com" className={`${inputCls} resize-y`} />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
        >
          {isPending ? 'Saving…' : runbook ? 'Save changes' : 'Create runbook'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2.5 rounded-lg text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
