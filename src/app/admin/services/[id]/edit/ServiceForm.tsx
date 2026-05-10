'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateService } from '../../actions'
import type { Service } from '@/lib/domain/types'

const SERVICE_TYPES = [
  'static-site', 'landing', 'corporate-site', 'ecommerce', 'saas', 'api',
  'mobile-backend', 'database', 'docker-service', 'k8s-deployment', 'cron',
  'worker', 'firebase-project', 'external-saas', 'domain', 'email', 'other',
] as const

export type ServiceFormData = Pick<
  Service,
  'id' | 'name' | 'type' | 'environment' | 'criticality' | 'tags' | 'description' | 'urls' | 'access' | 'visibility'
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

  // URLs
  const [urlPrimary, setUrlPrimary] = useState(service.urls.primary ?? '')
  const [urlAdmin, setUrlAdmin] = useState(service.urls.admin ?? '')
  const [urlHealthcheck, setUrlHealthcheck] = useState(service.urls.healthcheck ?? '')
  const [urlDocs, setUrlDocs] = useState(service.urls.docs ?? '')

  // Access
  const [accessLevel, setAccessLevel] = useState(service.access.level)
  const [accessProviders, setAccessProviders] = useState(service.access.providers.join(', '))
  const [accessNotes, setAccessNotes] = useState(service.access.notes ?? '')

  // Visibility
  const [statusPage, setStatusPage] = useState(service.visibility.statusPage)
  const [reportSharing, setReportSharing] = useState(service.visibility.reportSharing)

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
          urls: {
            primary: urlPrimary.trim() || undefined,
            admin: urlAdmin.trim() || undefined,
            healthcheck: urlHealthcheck.trim() || undefined,
            docs: urlDocs.trim() || undefined,
          },
          access: {
            level: accessLevel,
            providers: accessProviders.split(',').map((p) => p.trim()).filter(Boolean),
            notes: accessNotes.trim(),
          },
          visibility: { statusPage, reportSharing },
        })
        router.push(`/admin/services/${service.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
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
        <label className={labelCls}>Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
      </div>

      {/* Type / Env / Criticality */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectCls}>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Environment</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as typeof environment)} className={selectCls}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="dev">Dev</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Criticality</label>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value as typeof criticality)} className={selectCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-y`} />
      </div>

      {/* Tags */}
      <div>
        <label className={labelCls}>Tags (comma-separated)</label>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ecommerce, auth" className={inputCls} />
      </div>

      {/* URLs */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">URLs</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Primary</label>
            <input type="url" value={urlPrimary} onChange={(e) => setUrlPrimary(e.target.value)} placeholder="https://example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Admin</label>
            <input type="url" value={urlAdmin} onChange={(e) => setUrlAdmin(e.target.value)} placeholder="https://example.com/wp-admin" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Healthcheck</label>
            <input type="url" value={urlHealthcheck} onChange={(e) => setUrlHealthcheck(e.target.value)} placeholder="https://example.com/health" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Docs</label>
            <input type="url" value={urlDocs} onChange={(e) => setUrlDocs(e.target.value)} placeholder="https://docs.example.com" className={inputCls} />
          </div>
        </div>
      </fieldset>

      {/* Access */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">Access</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Level</label>
            <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as typeof accessLevel)} className={selectCls}>
              <option value="none">None</option>
              <option value="read-only">Read-only</option>
              <option value="operational">Operational</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Providers (comma-separated)</label>
            <input type="text" value={accessProviders} onChange={(e) => setAccessProviders(e.target.value)} placeholder="GitHub, Vercel" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Access notes</label>
          <input type="text" value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} className={inputCls} />
        </div>
      </fieldset>

      {/* Visibility */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">Visibility</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status page</label>
            <select value={statusPage} onChange={(e) => setStatusPage(e.target.value as typeof statusPage)} className={selectCls}>
              <option value="private">Private</option>
              <option value="tokenized">Tokenized</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Report sharing</label>
            <select value={reportSharing} onChange={(e) => setReportSharing(e.target.value as typeof reportSharing)} className={selectCls}>
              <option value="private">Private</option>
              <option value="tokenized">Tokenized</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="submit" disabled={isPending} className="btn-primary px-6 py-2.5">
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/services/${service.id}`)}
          className="btn-secondary px-6 py-2.5"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
