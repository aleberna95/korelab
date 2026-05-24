'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreateClientSchema } from '@/lib/domain/schemas/client'
import { upsertClient } from '@/lib/actions/clients'

type Initial = {
  name?: string
  email?: string
  phone?: string
  vatNumber?: string
  taxCode?: string
  address?: string
  pec?: string
  sdi?: string
  notes?: string
  tags?: string[]
  status?: 'active' | 'archived'
}

type Props = {
  id?: string
  initial?: Initial
  onSuccess?: (clientId: string) => void
}

export function ClientForm({ id, initial, onSuccess }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [vatNumber, setVatNumber] = useState(initial?.vatNumber ?? '')
  const [taxCode, setTaxCode] = useState(initial?.taxCode ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [pec, setPec] = useState(initial?.pec ?? '')
  const [sdi, setSdi] = useState(initial?.sdi ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [status, setStatus] = useState<'active' | 'archived'>(initial?.status ?? 'active')

  function validate() {
    const result = CreateClientSchema.safeParse({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      vatNumber: vatNumber.trim() || undefined,
      taxCode: taxCode.trim() || undefined,
      address: address.trim() || undefined,
      pec: pec.trim() || undefined,
      sdi: sdi.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
    })
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errs[key] = issue.message
      }
      setErrors(errs)
      return null
    }
    setErrors({})
    return result.data
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return

    startTransition(async () => {
      try {
        const clientId = await upsertClient(id ?? null, data)
        toast.success('Cliente salvato')
        if (onSuccess) {
          onSuccess(clientId)
        } else {
          router.push(`/admin/clients/${clientId}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Salvataggio fallito')
      }
    })
  }

  const fieldCls = (field: string) =>
    `input-base${errors[field] ? ' !border-[var(--color-danger)]' : ''}`

  const labelCls = 'block text-sm text-[var(--color-fg-muted)] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nome */}
      <div>
        <label className={labelCls}>
          Nome <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          className={fieldCls('name')}
          placeholder="Es. Mario Rossi / Acme S.r.l."
          autoFocus
        />
        {errors.name && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name}</p>
        )}
      </div>

      {/* Email + Telefono */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={fieldCls('email')}
            placeholder="mario@esempio.it"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Telefono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldCls('phone')}
            placeholder="+39 333 1234567"
          />
        </div>
      </div>

      {/* Dati fiscali */}
      <div>
        <p className="text-xs font-semibold text-[var(--color-fg-faint)] uppercase tracking-wide mb-3">
          Dati fiscali
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Partita IVA</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className={fieldCls('vatNumber')}
              placeholder="IT12345678901"
            />
          </div>
          <div>
            <label className={labelCls}>Codice fiscale</label>
            <input
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className={fieldCls('taxCode')}
              placeholder="RSSMRA80A01H501Z"
            />
          </div>
          <div>
            <label className={labelCls}>PEC</label>
            <input
              type="email"
              value={pec}
              onChange={(e) => setPec(e.target.value)}
              aria-invalid={!!errors.pec}
              className={fieldCls('pec')}
              placeholder="mario@pec.it"
            />
            {errors.pec && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.pec}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Codice SDI</label>
            <input
              type="text"
              value={sdi}
              onChange={(e) => setSdi(e.target.value)}
              className={fieldCls('sdi')}
              placeholder="XXXXXXX"
            />
          </div>
        </div>
      </div>

      {/* Indirizzo */}
      <div>
        <label className={labelCls}>Indirizzo sede legale</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={fieldCls('address')}
          placeholder="Via Roma 1, 20100 Milano (MI)"
        />
      </div>

      {/* Note */}
      <div>
        <label className={labelCls}>Note interne</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${fieldCls('notes')} resize-y`}
          placeholder="Informazioni aggiuntive…"
        />
      </div>

      {/* Tag */}
      <div>
        <label className={labelCls}>
          Tag{' '}
          <span className="text-xs text-[var(--color-fg-faint)]">(separati da virgola)</span>
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={fieldCls('tags')}
          placeholder="vip, ecommerce"
        />
      </div>

      {/* Stato — only for edit */}
      {id && (
        <div>
          <label className={labelCls}>Stato</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
            className={fieldCls('status')}
          >
            <option value="active">Attivo</option>
            <option value="archived">Archiviato</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Salvataggio…' : id ? 'Salva modifiche' : 'Crea cliente'}
        </button>
      </div>
    </form>
  )
}
