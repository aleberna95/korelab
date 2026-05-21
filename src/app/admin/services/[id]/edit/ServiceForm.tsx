'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateService } from '../../actions'
import type { Service } from '@/lib/domain/types'

const SERVICE_TYPES = [
  'static-site', 'landing', 'corporate-site', 'ecommerce', 'saas',
  'api', 'mobile-backend', 'firebase-project', 'domain', 'other',
] as const

export type ServiceFormData = Pick<
  Service,
  | 'id' | 'name' | 'type' | 'environment' | 'criticality' | 'tags' | 'description'
  | 'url'
>

type Props = { service: ServiceFormData }

export function ServiceForm({ service }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Basic
  const [name, setName] = useState(service.name)
  const [type, setType] = useState(service.type)
  const [environment, setEnvironment] = useState(service.environment)
  const [criticality, setCriticality] = useState(service.criticality)
  const [description, setDescription] = useState(service.description ?? '')
  const [tags, setTags] = useState(service.tags.join(', '))
  const [url, setUrl] = useState(service.url ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }

    startTransition(async () => {
      try {
        await updateService(service.id, {
          name: name.trim(),
          type,
          environment,
          criticality,
          description: description.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          url: url.trim() || undefined,
        })
        router.push(`/admin/services/${service.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Salvataggio fallito')
      }
    })
  }

  const inputCls = 'input-base'
  const labelCls = 'block text-sm text-gray-600 mb-1'
  const selectCls = 'input-base'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className={labelCls}>Nome *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
      </div>

      {/* Type / Env / Criticality */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectCls}>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ambiente</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as typeof environment)} className={selectCls}>
            <option value="production">Produzione</option>
            <option value="staging">Staging</option>
            <option value="dev">Sviluppo</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Criticità</label>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value as typeof criticality)} className={selectCls}>
            <option value="low">Bassa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Critica</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
          <label className={labelCls}>Descrizione</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-y`} />
      </div>

      {/* Tags */}
      <div>
          <label className={labelCls}>Tag (separati da virgola)</label>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ecommerce, auth" className={inputCls} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>URL principale</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className={inputCls} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="submit" disabled={isPending} className="btn-primary px-6 py-2.5">
          {isPending ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/services/${service.id}`)}
          className="btn-secondary px-6 py-2.5"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
