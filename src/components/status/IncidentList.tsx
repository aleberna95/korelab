import type { PublicIncident } from '@/lib/status/projector'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-400',
  major: 'text-orange-400',
  minor: 'text-amber-400',
}

function fmt(d: Date | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function fmtDuration(sec: number | undefined): string | null {
  if (sec === undefined) return null
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${(sec / 3600).toFixed(1)}h`
}

type Props = {
  active?: PublicIncident
  recent: PublicIncident[]
}

export function IncidentList({ active, recent }: Props) {
  if (!active && recent.length === 0) {
    return <p className="text-sm text-zinc-400">No incidents in this period.</p>
  }

  return (
    <div className="space-y-4">
      {active && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-sm font-semibold text-red-300">{active.title}</p>
            <span className={`ml-auto text-xs capitalize ${SEVERITY_STYLES[active.severity] ?? ''}`}>
              {active.severity}
            </span>
          </div>
          {active.publicMessage && (
            <p className="text-sm text-zinc-300">{active.publicMessage}</p>
          )}
          <p className="text-xs text-zinc-500">Since {fmt(active.startedAt)}</p>
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          {recent.map((inc, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-zinc-200">{inc.title}</p>
                <span className={`text-xs capitalize shrink-0 ${SEVERITY_STYLES[inc.severity] ?? ''}`}>
                  {inc.severity}
                </span>
              </div>
              {inc.publicMessage && (
                <p className="text-xs text-zinc-400 mt-1">{inc.publicMessage}</p>
              )}
              <div className="flex gap-3 mt-1.5 text-xs text-zinc-500">
                <span>{fmt(inc.startedAt)}</span>
                {inc.resolvedAt && <span>→ {fmt(inc.resolvedAt)}</span>}
                {fmtDuration(inc.downtimeSec) && (
                  <span className="text-zinc-600">Downtime: {fmtDuration(inc.downtimeSec)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
