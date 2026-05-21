'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { z } from 'zod'
import { upsertService } from '@/lib/actions/services'

// ─── Validation ───────────────────────────────────────────────────────────────

const FormSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  url: z.string().url('Inserisci un URL valido (es. https://esempio.it)'),
  clientId: z.string().min(1, 'Seleziona un cliente'),
  intervalSec: z.number().int(),
  description: z.string().optional(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientOption = { id: string; name: string }

type Initial = {
  name?: string
  url?: string
  clientId?: string
  intervalSec?: number
  description?: string
}

type Props = {
  clients: ClientOption[]
  id?: string
  initial?: Initial
  onSuccess?: (serviceId: string) => void
}

const INTERVALS = [
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 ora', value: 3600 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceForm({ clients, id, initial, onSuccess }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState(initial?.name ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [clientId, setClientId] = useState(initial?.clientId ?? '')
  const [intervalSec, setIntervalSec] = useState(initial?.intervalSec ?? 300)
  const [description, setDescription] = useState(initial?.description ?? '')

  function validate() {
    const result = FormSchema.safeParse({
      name: name.trim(),
      url: url.trim(),
      clientId,
      intervalSec,
      description: description.trim() || undefined,
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

    const trimmedUrl = data.url

    startTransition(async () => {
      try {
        const serviceId = await upsertService(id ?? null, {
          name: data.name,
          clientId: data.clientId,
          type: 'other',
          environment: 'production',
          criticality: 'medium',
          tags: [],
          description: data.description ?? '',
          url: trimmedUrl,
          currentStatus: { state: 'unknown' },
          check: {
            enabled: true,
            url: trimmedUrl,
            intervalSec: data.intervalSec,
            timeoutMs: 10000,
            expectStatus: 200,
            sslCheck: trimmedUrl.startsWith('https://'),
            sslAlertDays: [30, 14, 7, 1],
            alertedThresholds: [],
          },
        })
        toast.success('Servizio salvato')
        if (onSuccess) {
          onSuccess(serviceId)
        } else {
          router.push(`/admin/services/${serviceId}`)
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
          Cosa stai monitorando?{' '}
          <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          className={fieldCls('name')}
          placeholder="Es. Sito rossi.it"
          autoFocus
        />
        {errors.name && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name}</p>
        )}
      </div>

      {/* URL */}
      <div>
        <label className={labelCls}>
          Indirizzo (URL){' '}
          <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!errors.url}
          className={fieldCls('url')}
          placeholder="https://esempio.it"
        />
        {errors.url && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.url}</p>
        )}
      </div>

      {/* Cliente */}
      <div>
        <label className={labelCls}>
          Cliente <span className="text-[var(--color-danger)]">*</span>
        </label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-invalid={!!errors.clientId}
          className={fieldCls('clientId')}
        >
          <option value="">— Seleziona cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.clientId && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.clientId}</p>
        )}
      </div>

      {/* Intervallo */}
      <div>
        <label className={labelCls}>Controlla ogni</label>
        <div className="flex gap-2">
          {INTERVALS.map(({ label, value }) => (
            <label
              key={value}
              className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${
                intervalSec === value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium'
                  : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)]'
              }`}
            >
              <input
                type="radio"
                name="intervalSec"
                value={value}
                checked={intervalSec === value}
                onChange={() => setIntervalSec(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className={labelCls}>Note</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${fieldCls('description')} resize-y`}
          placeholder="Informazioni aggiuntive…"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Salvataggio…' : id ? 'Salva modifiche' : 'Aggiungi servizio'}
        </button>
      </div>
    </form>
  )
}
