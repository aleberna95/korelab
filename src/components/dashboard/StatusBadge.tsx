import type { ServiceStatusState } from '@/lib/domain/types'

const STATE_STYLES: Record<ServiceStatusState | string, { bg: string; text: string; label: string }> = {
  operational: { bg: 'bg-green-100', text: 'text-green-800', label: 'Operational' },
  degraded: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Degraded' },
  'partial-outage': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Partial outage' },
  'major-outage': { bg: 'bg-red-100', text: 'text-red-800', label: 'Major outage' },
  maintenance: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Maintenance' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unknown' },
}

type Props = {
  state: ServiceStatusState | string
  size?: 'sm' | 'md'
}

export function StatusBadge({ state, size = 'md' }: Props) {
  const style = STATE_STYLES[state] ?? STATE_STYLES['unknown']
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs font-medium px-2 py-0.5'
  return (
    <span className={`inline-flex items-center rounded-full ${style.bg} ${style.text} ${sizeClass} whitespace-nowrap`}>
      {style.label}
    </span>
  )
}
