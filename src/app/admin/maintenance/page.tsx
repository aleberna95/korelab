import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { maintenanceRepo } from '@/lib/repos/maintenanceRepo'

export const metadata: Metadata = { title: 'Maintenance Windows — Command Center' }

export default async function MaintenancePage() {
  await requireAdmin()

  const windows = await maintenanceRepo.list({ limit: 50 })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Windows</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scheduled windows suppress incident creation for affected services.
          </p>
        </div>
        {/* Future: "New window" button → Phase 6 */}
      </header>

      {windows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">No maintenance windows scheduled.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {windows.map((mw) => (
            <div key={mw.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{mw.title}</p>
                  {mw.publicMessage && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{mw.publicMessage}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-500">
                    {formatTime(mw.startsAt as unknown as { toDate(): Date })} →{' '}
                    {formatTime(mw.endsAt as unknown as { toDate(): Date })}
                  </p>
                  {mw.suppressIncidents && (
                    <span className="text-xs text-orange-600 font-medium">Incidents suppressed</span>
                  )}
                </div>
              </div>
              {mw.serviceIds.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Services: {mw.serviceIds.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(ts: { toDate(): Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ts.toDate())
}
