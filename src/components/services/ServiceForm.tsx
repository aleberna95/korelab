'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { z } from 'zod'
import { upsertService } from '@/lib/actions/services'

// ─── Validation ───────────────────────────────────────────────────────────────

const FormSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  clientId: z.string().min(1, 'Seleziona un cliente'),
  url: z.string().url('Inserisci un URL valido (es. https://esempio.it)').optional().or(z.literal('')),
  intervalSec: z.number().int(),
  description: z.string().optional(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientOption = { id: string; name: string }

type ServiceType =
  | 'static-site' | 'landing' | 'corporate-site' | 'ecommerce' | 'saas'
  | 'api' | 'mobile-backend' | 'firebase-project' | 'domain' | 'other'

type Initial = {
  name?: string
  url?: string
  clientId?: string
  intervalSec?: number
  description?: string
  type?: ServiceType
  environment?: 'production' | 'staging' | 'dev'
  criticality?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string
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

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'static-site', label: 'Sito statico' },
  { value: 'landing', label: 'Landing page' },
  { value: 'corporate-site', label: 'Sito corporate' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'api', label: 'API' },
  { value: 'mobile-backend', label: 'Mobile backend' },
  { value: 'firebase-project', label: 'Firebase project' },
  { value: 'domain', label: 'Dominio' },
  { value: 'other', label: 'Altro' },
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
  const [type, setType] = useState<ServiceType>(initial?.type ?? 'other')
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'dev'>(
    initial?.environment ?? 'production',
  )
  const [criticality, setCriticality] = useState<'low' | 'medium' | 'high' | 'critical'>(
    initial?.criticality ?? 'medium',
  )
  const [tags, setTags] = useState(initial?.tags ?? '')

  function validate() {
    const result = FormSchema.safeParse({
      name: name.trim(),
      url: url.trim() || undefined,
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

    const trimmedUrl = data.url?.trim() || undefined
    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)

    startTransition(async () => {
      try {
        const serviceId = await upsertService(id ?? null, {
          name: data.name,
          clientId: data.clientId,
          type,
          environment,
          criticality,
          tags: parsedTags,
          description: data.description ?? '',
          url: trimmedUrl,
          currentStatus: { state: 'unknown' },
          ...(trimmedUrl
            ? {
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
              }
            : {}),
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
    `input-base${errors[field] ? ' !border-danger' : ''}`

  const labelCls = 'block text-sm text-fg-muted mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nome */}
      <div>
        <label className={labelCls}>
          Nome <span className="text-danger">*</span>
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
          <p className="mt-1 text-xs text-danger">{errors.name}</p>
        )}
      </div>

      {/* Tipo / Ambiente / Criticità */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as ServiceType)} className={fieldCls('type')}>
            {SERVICE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ambiente</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as typeof environment)} className={fieldCls('environment')}>
            <option value="production">Produzione</option>
            <option value="staging">Staging</option>
            <option value="dev">Sviluppo</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Criticità</label>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value as typeof criticality)} className={fieldCls('criticality')}>
            <option value="low">Bassa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Critica</option>
          </select>
        </div>
      </div>

      {/* Cliente */}
      <div>
        <label className={labelCls}>
          Cliente <span className="text-danger">*</span>
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
          <p className="mt-1 text-xs text-danger">{errors.clientId}</p>
        )}
      </div>

      {/* Descrizione */}
      <div>
        <label className={labelCls}>Descrizione</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${fieldCls('description')} resize-y`}
          placeholder="Informazioni aggiuntive…"
        />
      </div>

      {/* Tag */}
      <div>
        <label className={labelCls}>Tag (separati da virgola)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={fieldCls('tags')}
          placeholder="ecommerce, auth"
        />
      </div>

      {/* URL */}
      <div>
        <label className={labelCls}>URL principale</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!errors.url}
          className={fieldCls('url')}
          placeholder="https://esempio.it"
        />
        {errors.url && (
          <p className="mt-1 text-xs text-danger">{errors.url}</p>
        )}
      </div>

      {/* Intervallo */}
      {url && (
        <div>
          <label className={labelCls}>Controlla ogni</label>
          <div className="flex gap-2">
            {INTERVALS.map(({ label, value }) => (
              <label
                key={value}
                className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer rounded-sm border px-3 py-2 text-sm transition-colors ${
                  intervalSec === value
                    ? 'border-accent bg-accent-soft text-accent font-medium'
                    : 'border-border text-fg-muted hover:border-accent'
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
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Salvataggio…' : id ? 'Salva modifiche' : 'Aggiungi servizio'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}

