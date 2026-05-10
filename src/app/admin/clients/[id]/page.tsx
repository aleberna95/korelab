import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { StatusBadge } from '@/components/dashboard/StatusBadge'

export const metadata: Metadata = { title: 'Client — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function ClientDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [client, services] = await Promise.all([
    clientsRepo.getById(id),
    servicesRepo.list({ clientId: id, limit: 100 }),
  ])

  if (!client) notFound()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/admin/clients" className="hover:underline">Clients</Link>
        {' '}/{' '}
        <span className="text-gray-900">{client.name}</span>
      </nav>

      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">
          {client.businessType} · {client.supportPlan.replace(/-/g, ' ')} ·{' '}
          <span className={client.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
            {client.status}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: meta */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Contacts
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {client.contacts.map((c, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.role}</p>
                  </div>
                  <div className="text-right">
                    <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline block">
                      {c.email}
                    </a>
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    {c.primary && <span className="text-xs text-green-600">Primary</span>}
                  </div>
                </div>
              ))}
              {client.contacts.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No contacts.</p>
              )}
            </div>
          </section>

          {/* Services */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Services ({services.length})
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {services.map((svc) => (
                <Link
                  key={svc.id}
                  href={`/admin/services/${svc.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{svc.environment} · {svc.type.replace(/-/g, ' ')}</p>
                  </div>
                  <StatusBadge state={svc.currentStatus.state} size="sm" />
                </Link>
              ))}
              {services.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No services.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right: consent + notification */}
        <div className="space-y-6">
          {/* Consent matrix */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Consent
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 space-y-2">
              {Object.entries(client.consent)
                .filter(([k]) => k !== 'consentedAt')
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={`text-xs font-medium ${v ? 'text-green-600' : 'text-gray-400'}`}>
                      {v ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* Notification prefs */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Notifications
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 space-y-1.5 text-sm">
              <p className="text-gray-600">
                Email: <span className="font-medium">{client.notificationPrefs.email ? 'Yes' : 'No'}</span>
              </p>
              {client.notificationPrefs.emails?.length > 0 && (
                <p className="text-xs text-gray-400">{client.notificationPrefs.emails.join(', ')}</p>
              )}
              {client.notificationPrefs.telegramChatId && (
                <p className="text-gray-600">
                  Telegram: <span className="font-mono text-xs">{client.notificationPrefs.telegramChatId}</span>
                </p>
              )}
            </div>
          </section>

          {/* Notes */}
          {client.notes && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Notes
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
