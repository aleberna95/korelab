import type { PublicMaintenance } from '@/lib/status/projector'

function fmt(d: Date): string {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

type Props = {
  windows: PublicMaintenance[]
}

export function MaintenanceList({ windows }: Props) {
  if (windows.length === 0) return null

  return (
    <div className="space-y-3">
      {windows.map((mw, i) => {
        const now = Date.now()
        const isActive = mw.startsAt.getTime() <= now && mw.endsAt.getTime() >= now
        const isUpcoming = mw.startsAt.getTime() > now

        return (
          <div
            key={i}
            className={`rounded-xl px-5 py-4 border space-y-1 ${
              isActive
                ? 'bg-blue-50 border-blue-200'
                : isUpcoming
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{mw.title}</span>
              {isActive && (
                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                  Attiva
                </span>
              )}
              {isUpcoming && (
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  Pianificata
                </span>
              )}
            </div>
            {mw.publicMessage && (
              <p className="text-sm text-gray-600">{mw.publicMessage}</p>
            )}
            <p className="text-xs text-gray-400">
              {fmt(mw.startsAt)} → {fmt(mw.endsAt)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
