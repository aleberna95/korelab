import type { PublicMaintenance } from '@/lib/status/projector'

function fmt(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
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
                ? 'bg-blue-950/40 border-blue-700/50'
                : isUpcoming
                  ? 'bg-zinc-900 border-zinc-700'
                  : 'bg-zinc-900/40 border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-300">{mw.title}</span>
              {isActive && (
                <span className="text-xs bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
              {isUpcoming && (
                <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                  Scheduled
                </span>
              )}
            </div>
            {mw.publicMessage && (
              <p className="text-sm text-zinc-300">{mw.publicMessage}</p>
            )}
            <p className="text-xs text-zinc-500">
              {fmt(mw.startsAt)} → {fmt(mw.endsAt)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
