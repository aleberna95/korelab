'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateClient } from './actions'

export type ClientFormData = {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  tags: string[]
  status: 'active' | 'archived'
}

type Props = { client: ClientFormData }

export function ClientForm({ client }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email)
  const [phone, setPhone] = useState(client.phone)
  const [status, setStatus] = useState(client.status)
  const [notes, setNotes] = useState(client.notes)
  const [tags, setTags] = useState(client.tags.join(', '))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Il nome è obbligatorio'); return }

    startTransition(async () => {
      try {
        await updateClient(client.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        })
        router.push(`/admin/clients/${client.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Salvataggio fallito')
      }
    })
  }

  const inputCls = 'input-base'
  const labelCls = 'block text-sm text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Informazioni</h2>
        <div>
          <label className={labelCls}>Nome *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefono</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
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
        <div>
          <label className={labelCls}>Stato</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
            <option value="active">Attivo</option>
            <option value="archived">Archiviato</option>
          </select>
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


