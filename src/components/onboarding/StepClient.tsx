'use client'

import { useState } from 'react'
import { useWizard, type WizardContact } from '@/lib/onboarding/state'
import type { ClientOption } from './WizardShell'

type Props = { clientOptions: ClientOption[] }

const BUSINESS_TYPES = [
  { value: 'agency', label: 'Agency' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'startup', label: 'Startup' },
  { value: 'other', label: 'Other' },
]

const SUPPORT_PLANS = [
  { value: 'none', label: 'None — no monitoring or support' },
  { value: 'monitor-only', label: 'Monitor only' },
  { value: 'reporting-only', label: 'Reporting only' },
  { value: 'managed-support', label: 'Managed support' },
  { value: 'managed-infra', label: 'Managed infrastructure' },
  { value: 'auto-healing', label: 'Auto-healing' },
]

function ContactRow({
  contact,
  index,
  onRemove,
}: {
  contact: WizardContact
  index: number
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-900 rounded-md px-3 py-2">
      <span className="flex-1">
        {contact.name} · {contact.email} · {contact.role}
        {contact.primary && (
          <span className="ml-2 text-xs text-indigo-400 font-medium">Primary</span>
        )}
      </span>
      <button
        onClick={onRemove}
        className="text-zinc-500 hover:text-red-400 text-xs"
        type="button"
      >
        Remove
      </button>
    </div>
  )
}

function AddContactForm({ onAdd }: { onAdd: (c: WizardContact) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [primary, setPrimary] = useState(false)
  const [open, setOpen] = useState(false)

  function submit() {
    if (!name.trim() || !email.trim() || !role.trim()) return
    onAdd({ name: name.trim(), email: email.trim(), phone: phone.trim(), role: role.trim(), primary })
    setName(''); setEmail(''); setPhone(''); setRole(''); setPrimary(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
      >
        + Add contact
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-md p-3 space-y-2 border border-zinc-700">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={INPUT} />
        </Field>
        <Field label="Email *">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" className={INPUT} type="email" />
        </Field>
        <Field label="Role *">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="CTO" className={INPUT} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333..." className={INPUT} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
        <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="accent-indigo-500" />
        Primary contact
      </label>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={submit} className={BTN_PRIMARY}>Add</button>
        <button type="button" onClick={() => setOpen(false)} className={BTN_GHOST}>Cancel</button>
      </div>
    </div>
  )
}

const INPUT =
  'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const BTN_PRIMARY =
  'px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md'
const BTN_GHOST =
  'px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200'

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

export function StepClient({ clientOptions }: Props) {
  const { state, dispatch } = useWizard()

  const c = state.client

  function patchClient(patch: Partial<typeof c>) {
    dispatch({ type: 'UPDATE_CLIENT', patch })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Client</h2>
        <p className="text-sm text-zinc-400 mt-1">Link this service to an existing client or create a new one.</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3">
        {(['new', 'existing'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => dispatch({ type: 'SET_CLIENT_MODE', mode })}
            className={[
              'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
              state.clientMode === mode
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white',
            ].join(' ')}
          >
            {mode === 'new' ? 'New client' : 'Existing client'}
          </button>
        ))}
      </div>

      {/* ── Existing client picker ── */}
      {state.clientMode === 'existing' && (
        <Field label="Select client *">
          <select
            value={state.existingClientId}
            onChange={(e) => {
              const selected = clientOptions.find((c) => c.id === e.target.value)
              dispatch({
                type: 'SET_EXISTING_CLIENT',
                id: e.target.value,
                supportPlan: selected?.supportPlan ?? '',
              })
            }}
            className={INPUT}
          >
            <option value="">— choose —</option>
            {clientOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.supportPlan})
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* ── New client form ── */}
      {state.clientMode === 'new' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name *">
              <input
                value={c.name}
                onChange={(e) => patchClient({ name: e.target.value })}
                placeholder="ACME Corp"
                className={INPUT}
              />
            </Field>

            <Field label="Business type *">
              <select
                value={c.businessType}
                onChange={(e) => patchClient({ businessType: e.target.value })}
                className={INPUT}
              >
                <option value="">— select —</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Support plan *">
            <select
              value={c.supportPlan}
              onChange={(e) => patchClient({ supportPlan: e.target.value })}
              className={INPUT}
            >
              {SUPPORT_PLANS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>

          {/* Contacts */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Contacts *
            </label>
            {c.contacts.map((contact, i) => (
              <ContactRow
                key={i}
                contact={contact}
                index={i}
                onRemove={() => dispatch({ type: 'REMOVE_CONTACT', index: i })}
              />
            ))}
            <AddContactForm
              onAdd={(contact) => dispatch({ type: 'ADD_CONTACT', contact })}
            />
          </div>

          {/* Notification prefs */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Notifications
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={c.notificationEmail}
                onChange={(e) => patchClient({ notificationEmail: e.target.checked })}
                className="accent-indigo-500"
              />
              Send email alerts
            </label>
            {c.notificationEmail && (
              <Field label="Alert emails (comma-separated)">
                <input
                  value={c.notificationEmails}
                  onChange={(e) => patchClient({ notificationEmails: e.target.value })}
                  placeholder="ops@acme.com, cto@acme.com"
                  className={INPUT}
                />
              </Field>
            )}
            <Field label="Telegram chat ID (optional)">
              <input
                value={c.telegramChatId}
                onChange={(e) => patchClient({ telegramChatId: e.target.value })}
                placeholder="-1001234567890"
                className={INPUT}
              />
            </Field>
          </div>

          {/* Consent */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Client consent
            </label>
            {(
              [
                ['consentMonitoring', 'Monitoring'],
                ['consentNotification', 'Incident notifications'],
                ['consentIntervention', 'Manual intervention'],
                ['consentAutoHealing', 'Auto-healing actions'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c[key]}
                  onChange={(e) => patchClient({ [key]: e.target.checked })}
                  className="accent-indigo-500"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contract URL (optional)">
              <input
                value={c.contractUrl}
                onChange={(e) => patchClient({ contractUrl: e.target.value })}
                placeholder="https://notion.so/..."
                className={INPUT}
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                value={c.tags}
                onChange={(e) => patchClient({ tags: e.target.value })}
                placeholder="agency, retainer"
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Internal notes">
            <textarea
              value={c.notes}
              onChange={(e) => patchClient({ notes: e.target.value })}
              rows={2}
              placeholder="Internal notes about this client…"
              className={INPUT}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
