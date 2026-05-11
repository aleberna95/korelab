'use client'

import { useState } from 'react'
import { useWizard, type WizardContact } from '@/lib/onboarding/state'
import type { ClientOption } from './WizardShell'

type Props = { clientOptions: ClientOption[] }

const BUSINESS_TYPES = [
  { value: 'agency', label: 'Agenzia' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'startup', label: 'Startup' },
  { value: 'other', label: 'Altro' },
]

const SUPPORT_PLANS = [
  { value: 'monitor-only', label: 'Solo monitoraggio' },
  { value: 'managed', label: 'Supporto gestito' },
  { value: 'full', label: 'Full service' },
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
    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
      <span className="flex-1">
        {contact.name} · {contact.email} · {contact.role}
        {contact.primary && (
          <span className="ml-2 text-xs text-blue-600 font-medium">Principale</span>
        )}
      </span>
      <button
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 text-xs"
        type="button"
      >
        Rimuovi
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
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Aggiungi contatto
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-md p-3 space-y-2 border border-gray-200">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nome *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={INPUT} />
        </Field>
        <Field label="Email *">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" className={INPUT} type="email" />
        </Field>
        <Field label="Ruolo *">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="CTO" className={INPUT} />
        </Field>
        <Field label="Telefono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333..." className={INPUT} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
        <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="accent-blue-600" />
        Contatto principale
      </label>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={submit} className={BTN_PRIMARY}>Aggiungi</button>
        <button type="button" onClick={() => setOpen(false)} className={BTN_GHOST}>Annulla</button>
      </div>
    </div>
  )
}

const INPUT = 'input-base'
const BTN_PRIMARY = 'px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md'
const BTN_GHOST = 'px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800'

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

export function StepClient({ clientOptions }: Props) {
  const { state, dispatch } = useWizard()
  const c = state.client

  function patchClient(patch: Partial<typeof c>) {
    dispatch({ type: 'UPDATE_CLIENT', patch })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Cliente</h2>
        <p className="text-sm text-gray-500 mt-1">Collega questo servizio a un cliente esistente o creane uno nuovo.</p>
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
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            {mode === 'new' ? 'Nuovo cliente' : 'Cliente esistente'}
          </button>
        ))}
      </div>

      {/* Existing client picker */}
      {state.clientMode === 'existing' && (
        <Field label="Seleziona cliente *">
          <select
            value={state.existingClientId}
            onChange={(e) => dispatch({ type: 'SET_EXISTING_CLIENT', id: e.target.value })}
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

      {/* New client form */}
      {state.clientMode === 'new' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome azienda *">
              <input
                value={c.name}
                onChange={(e) => patchClient({ name: e.target.value })}
                placeholder="ACME Corp"
                className={INPUT}
              />
            </Field>

            <Field label="Tipo di azienda *">
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

          <Field label="Piano di supporto *">
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Contatti *
            </label>
            {c.contacts.map((contact, i) => (
              <ContactRow
                key={i}
                contact={contact}
                index={i}
                onRemove={() => dispatch({ type: 'REMOVE_CONTACT', index: i })}
              />
            ))}
            <AddContactForm onAdd={(contact) => dispatch({ type: 'ADD_CONTACT', contact })} />
          </div>

          {/* Telegram */}
          <Field label="Telegram chat ID (opzionale)">
            <input
              value={c.telegramChatId}
              onChange={(e) => patchClient({ telegramChatId: e.target.value })}
              placeholder="-1001234567890"
              className={INPUT}
            />
          </Field>

          {/* Consent */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Consenso cliente
            </label>
            {(
              [
                ['consentMonitoring', 'Monitoraggio'],
                ['consentNotification', 'Notifiche incidenti'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c[key]}
                  onChange={(e) => patchClient({ [key]: e.target.checked })}
                  className="accent-blue-600"
                />
                {label}
              </label>
            ))}
          </div>

          <Field label="Tag (separati da virgola)">
            <input
              value={c.tags}
              onChange={(e) => patchClient({ tags: e.target.value })}
              placeholder="agency, retainer"
              className={INPUT}
            />
          </Field>

          <Field label="Note interne">
            <textarea
              value={c.notes}
              onChange={(e) => patchClient({ notes: e.target.value })}
              rows={2}
              placeholder="Note interne su questo cliente…"
              className={INPUT}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
