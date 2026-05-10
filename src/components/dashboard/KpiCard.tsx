type Props = {
  label: string
  value: number | string
  sub?: string
  accent?: 'red' | 'amber' | 'green' | 'blue' | 'gray'
}

const ACCENT_STYLES = {
  red: 'border-l-red-500',
  amber: 'border-l-amber-500',
  green: 'border-l-green-500',
  blue: 'border-l-blue-500',
  gray: 'border-l-gray-300',
}

export function KpiCard({ label, value, sub, accent = 'gray' }: Props) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${ACCENT_STYLES[accent]} px-5 py-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
