import Link from 'next/link'
import type { PublicServiceView } from '@/lib/status/projector'
import { UptimeBar } from './UptimeBar'

const STATE_COLORS: Record<string, string> = {
  operational: 'bg-green-400',
  degraded: 'bg-amber-400',
  'partial-outage': 'bg-orange-400',
  'major-outage': 'bg-red-500',
  maintenance: 'bg-blue-400',
  unknown: 'bg-zinc-500',
}

type Props = {
  view: PublicServiceView
  href?: string
}

export function ServiceCard({ view, href }: Props) {
  const dot = STATE_COLORS[view.state] ?? 'bg-zinc-500'

  const card = (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 space-y-3 hover:border-zinc-500 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
          <p className="font-semibold text-white truncate">{view.name}</p>
        </div>
        <span className="text-xs text-zinc-400 capitalize shrink-0">
          {view.uptime30d.toFixed(2)}% 30d
        </span>
      </div>

      {view.daily90d.length > 0 && <UptimeBar bars={view.daily90d} />}

      {view.activeIncident && (
        <p className="text-xs text-red-400">
          🔴 {view.activeIncident.title}
        </p>
      )}
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
