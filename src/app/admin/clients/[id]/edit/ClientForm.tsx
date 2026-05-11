'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateClient } from './actions'
import type { SupportPlan } from '@/lib/domain/types'
import type { Contact } from '@/lib/domain/types'

export type ClientFormData = {
  id: string
  name: string
  businessType: 'agency' | 'ecommerce' | 'corporate' | 'startup' | 'other'
  contacts: Contact[]
  telegramChatId?: string
  supportPlan: SupportPlan
  consent: {
    monitoring: boolean
    notification: boolean
  }
  tags: string[]
  notes: string
  status: 'active' | 'paused' | 'archived'
}

const SUPPORT_PLANS: SupportPlan[] = [
  'monitor-only',
  'managed',
  'full',
]

type Props = { client: ClientFormData }

export function ClientForm({ client }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(client.name)
  const [businessType, setBusinessType] = useState(client.businessType)
  const [supportPlan, setSupportPlan] = useState(client.supportPlan)
  const [status, setStatus] = useState(client.status)
  const [notes, setNotes] = useState(client.notes ?? '')
  const [tags, setTags] = useState(client.tags.join(', '))

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState(client.telegramChatId ?? '')

  // Consent
  const [consentMonitoring, setConsentMonitoring] = useState(client.consent.monitoring)
  const [consentNotification, setConsentNotification] = useState(client.consent.notification)

  // Contacts
  const [contacts, setContacts] = useState(client.contacts)

  function updateContact(i: number, field: keyof Contact, value: string | boolean) {
    setContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: '', email: '', role: '', phone: '', primary: false }])
  }

  function removeContact(i: number) {
    setContacts((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Il nome è obbligatorio'); return }
    if (contacts.length === 0) { setError('Almeno un contatto è obbligatorio'); return }

    startTransition(async () => {
      try {
        await updateClient(client.id, {
          name: name.trim(),
          businessType,
          supportPlan,
          status,
          notes: notes.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          telegramChatId: telegramChatId.trim() || undefined,
          consent: {
            monitoring: consentMonitoring,
            notification: consentNotification,
          },
          contacts,
        })
        router.push(`/admin/clients/${client.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Salvataggio fallito')
      }
    })
  }

  const inputCls = 'input-base'
  const labelCls = 'block text-sm text-gray-600 mb-1'
  const checkboxCls = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Informazioni base</h2>
        <div>
          <label className={labelCls}>Nome *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tipo di attività</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value as typeof businessType)} className={inputCls}>
              {['agency', 'ecommerce', 'corporate', 'startup', 'other'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Piano di supporto</label>
            <select value={supportPlan} onChange={(e) => setSupportPlan(e.target.value as SupportPlan)} className={inputCls}>
              {SUPPORT_PLANS.map((p) => (
                <option key={p} value={p}>{p.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Stato</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
              <option value="active">Attivo</option>
              <option value="paused">In pausa</option>
              <option value="archived">Archiviato</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Tag (separati da virgola)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Note</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-y`} />
        </div>
      </section>

      {/* Contacts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Contatti</h2>
          <button type="button" onClick={addContact} className="text-xs text-blue-600 hover:text-blue-800">
            + Aggiungi contatto
          </button>
        </div>
        {contacts.map((c, i) => (
          <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Contatto {i + 1}</span>
              <button
                type="button"
                onClick={() => removeContact(i)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Rimuovi
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nome *</label>
                <input type="text" value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" value={c.email} onChange={(e) => updateContact(i, 'email', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ruolo *</label>
                <input type="text" value={c.role} onChange={(e) => updateContact(i, 'role', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telefono</label>
                <input type="tel" value={c.phone ?? ''} onChange={(e) => updateContact(i, 'phone', e.target.value)} className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={c.primary} onChange={(e) => updateContact(i, 'primary', e.target.checked)} className={checkboxCls} />
              Contatto principale
            </label>
          </div>
        ))}
      </section>

      {/* Consent */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Consensi</h2>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
          {([
            ['monitoring', consentMonitoring, setConsentMonitoring, 'Monitoraggio'],
            ['notification', consentNotification, setConsentNotification, 'Notifiche incidenti'],
          ] as const).map(([key, val, setter, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                className={checkboxCls}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Notifiche</h2>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <label className={labelCls}>Telegram Chat ID (opzionale)</label>
            <input type="text" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="-1001234567890" className={inputCls} />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/clients/${client.id}`)}
          className="btn-secondary"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
