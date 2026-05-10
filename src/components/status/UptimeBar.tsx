import type { DailyBar } from '@/lib/status/projector'

const PCT_COLOR = (pct: number): string => {
  if (pct >= 99.9) return 'bg-green-500'
  if (pct >= 99) return 'bg-green-400'
  if (pct >= 95) return 'bg-amber-400'
  if (pct >= 80) return 'bg-orange-400'
  return 'bg-red-500'
}

type Props = {
  bars: DailyBar[]
  /** Total number of squares to show (pad with gray if fewer bars) */
  total?: number
}

export function UptimeBar({ bars, total = 90 }: Props) {
  const padded: (DailyBar | null)[] = [
    ...Array(Math.max(0, total - bars.length)).fill(null),
    ...bars.slice(-total),
  ]

  return (
    <div className="flex gap-0.5" title="90-day uptime history">
      {padded.map((bar, i) =>
        bar === null ? (
          <span key={i} className="flex-1 h-6 rounded-sm bg-zinc-700 opacity-40" />
        ) : (
          <span
            key={i}
            className={`flex-1 h-6 rounded-sm ${PCT_COLOR(bar.uptimePct)}`}
            title={`${bar.date}: ${bar.uptimePct.toFixed(2)}%`}
          />
        ),
      )}
    </div>
  )
}
