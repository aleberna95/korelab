import { requireAdmin } from '@/lib/auth/guards'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import Link from 'next/link'

export default async function RunbooksPage() {
  await requireAdmin()

  const runbooks = await runbooksRepo.list({ limit: 100 })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Runbooks</h1>
          <p className="text-gray-500 text-sm mt-1">
            Step-by-step recovery guides for common failure scenarios.
          </p>
        </div>
        <Link
          href="/admin/runbooks/new"
          className="btn-primary text-sm"
        >
          New runbook
        </Link>
      </div>

      {runbooks.length === 0 ? (
        <p className="text-gray-500 text-sm">No runbooks yet.</p>
      ) : (
        <div className="grid gap-3">
          {runbooks.map((rb) => (
            <Link
              key={rb.id}
              href={`/admin/runbooks/${rb.id}`}
              className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-gray-900">{rb.title}</p>
                  {rb.notes && (
                    <p className="text-sm text-gray-500 line-clamp-1">{rb.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {rb.serviceTypes.map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                    {rb.appliesToTags.map((t) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-gray-500">
                    {rb.recoverySteps.length} step{rb.recoverySteps.length !== 1 ? 's' : ''}
                  </p>
                  {rb.commonFailures.length > 0 && (
                    <p className="text-xs text-gray-500">
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
