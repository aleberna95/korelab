import { requireAdmin } from '@/lib/auth/guards'
import { statusTokensRepo } from '@/lib/repos/statusTokensRepo'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import type { StatusToken } from '@/lib/domain/types'
import { CreateTokenForm } from './CreateTokenForm'
import { RevokeTokenButton } from './RevokeTokenButton'

function formatTs(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(ts.toDate())
}

function tokenUrl(token: StatusToken): string {
  return `/s/${token.id}` // placeholder — actual raw token is never stored
}

export default async function TokensPage() {
  await requireAdmin()

  const [tokens, clients, services] = await Promise.all([
    statusTokensRepo.list({ limit: 100 }),
    clientsRepo.list(),
    servicesRepo.list({ limit: 200 }),
  ])

  const clientMap = new Map(clients.map((c) => [c.id, c.name]))
  const serviceMap = new Map(services.map((s) => [s.id, s.name]))

  const active = tokens.filter((t) => !t.revokedAt)
  const revoked = tokens.filter((t) => t.revokedAt)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Status Tokens</h1>
          <p className="text-gray-500 text-sm mt-1">
            Share private status pages with clients via single-use tokens.
          </p>
        </div>
      </div>

      {/* Create token form */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Create new token</h2>
        <CreateTokenForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          services={services.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      {/* Active tokens */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-gray-500 text-sm">No active tokens.</p>
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">
                      {t.scope}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {t.scope === 'service'
                        ? (serviceMap.get(t.targetId) ?? t.targetId)
                        : (clientMap.get(t.targetId) ?? t.targetId)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Sections: {t.allowedSections.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400">
                    Created {formatTs(t.createdAt as unknown as { toDate(): Date })}
                    {t.expiresAt && ` · Expires ${formatTs(t.expiresAt as unknown as { toDate(): Date })}`}
                    {t.lastUsedAt && ` · Last used ${formatTs(t.lastUsedAt as unknown as { toDate(): Date })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RevokeTokenButton tokenId={t.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Revoked tokens */}
      {revoked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Revoked ({revoked.length})
          </h2>
          <div className="space-y-1 opacity-50">
            {revoked.map((t) => (
              <div
                key={t.id}
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm line-through text-gray-400"
              >
                {t.scope} ·{' '}
                {t.scope === 'service'
                  ? (serviceMap.get(t.targetId) ?? t.targetId)
                  : (clientMap.get(t.targetId) ?? t.targetId)}
                {' · revoked '}
                {formatTs(t.revokedAt as unknown as { toDate(): Date })}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
