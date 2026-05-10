type Props = {
  name: string
  state: string
  description?: string
}

const STATE_INFO: Record<string, { label: string; color: string; dot: string }> = {
  operational: { label: 'Tutti i sistemi operativi', color: 'text-green-700', dot: 'bg-green-500' },
  degraded: { label: 'Prestazioni degradate', color: 'text-amber-700', dot: 'bg-amber-400' },
  'partial-outage': { label: 'Interruzione parziale', color: 'text-orange-700', dot: 'bg-orange-400' },
  'major-outage': { label: 'Interruzione grave', color: 'text-red-700', dot: 'bg-red-500' },
  maintenance: { label: 'In manutenzione', color: 'text-blue-700', dot: 'bg-blue-400' },
  unknown: { label: 'Stato sconosciuto', color: 'text-gray-500', dot: 'bg-gray-400' },
}

export function StatusHeader({ name, state, description }: Props) {
  const info = STATE_INFO[state] ?? STATE_INFO['unknown']
  return (
    <header className="space-y-3">
      <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
      {description && <p className="text-gray-500 text-sm">{description}</p>}
      <div className="flex items-center gap-2.5">
        <span className={`w-3 h-3 rounded-full ${info.dot} shrink-0`} />
        <span className={`text-lg font-semibold ${info.color}`}>{info.label}</span>
      </div>
    </header>
  )
}
