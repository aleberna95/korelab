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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Status Tokens</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Share private status pages with clients via single-use tokens.
          </p>
        </div>
      </div>

      {/* Create token form */}
      <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Create new token</h2>
        <CreateTokenForm clients={clients} services={services} />
      </section>

      {/* Active tokens */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-zinc-500 text-sm">No active tokens.</p>
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <div
                key={t.id}
                className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 capitalize">
                      {t.scope}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {t.scope === 'service'
                        ? (serviceMap.get(t.targetId) ?? t.targetId)
                        : (clientMap.get(t.targetId) ?? t.targetId)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Sections: {t.allowedSections.join(', ')}
                  </p>
                  <p className="text-xs text-zinc-500">
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
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Revoked ({revoked.length})
          </h2>
          <div className="space-y-1 opacity-50">
            {revoked.map((t) => (
              <div
                key={t.id}
                className="bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-2 text-sm line-through text-zinc-500"
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
