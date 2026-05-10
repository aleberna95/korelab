import { requireAdmin } from '@/lib/auth/guards'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import Link from 'next/link'

export default async function RunbooksPage() {
  await requireAdmin()

  const runbooks = await runbooksRepo.list({ limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Runbooks</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Step-by-step recovery guides for common failure scenarios.
          </p>
        </div>
        <Link
          href="/admin/runbooks/new"
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          New runbook
        </Link>
      </div>

      {runbooks.length === 0 ? (
        <p className="text-zinc-500 text-sm">No runbooks yet.</p>
      ) : (
        <div className="grid gap-3">
          {runbooks.map((rb) => (
            <Link
              key={rb.id}
              href={`/admin/runbooks/${rb.id}`}
              className="block bg-zinc-800/60 border border-zinc-700 rounded-xl px-5 py-4 hover:border-zinc-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-white">{rb.title}</p>
                  {rb.notes && (
                    <p className="text-sm text-zinc-400 line-clamp-1">{rb.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {rb.serviceTypes.map((t) => (
                      <span key={t} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                    {rb.appliesToTags.map((t) => (
                      <span key={t} className="text-xs bg-zinc-700/60 text-zinc-400 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-zinc-500">
                    {rb.recoverySteps.length} step{rb.recoverySteps.length !== 1 ? 's' : ''}
                  </p>
                  {rb.commonFailures.length > 0 && (
                    <p className="text-xs text-zinc-500">
                      {rb.commonFailures.length} failure scenario{rb.commonFailures.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
