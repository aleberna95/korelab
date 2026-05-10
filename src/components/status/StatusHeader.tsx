type Props = {
  name: string
  state: string
  description?: string
}

const STATE_INFO: Record<string, { label: string; color: string; dot: string }> = {
  operational: { label: 'Tutti i sistemi operativi', color: 'text-green-400', dot: 'bg-green-400' },
  degraded: { label: 'Prestazioni degradate', color: 'text-amber-400', dot: 'bg-amber-400' },
  'partial-outage': { label: 'Interruzione parziale', color: 'text-orange-400', dot: 'bg-orange-400' },
  'major-outage': { label: 'Interruzione grave', color: 'text-red-400', dot: 'bg-red-400' },
  maintenance: { label: 'In manutenzione', color: 'text-blue-400', dot: 'bg-blue-400' },
  unknown: { label: 'Stato sconosciuto', color: 'text-zinc-400', dot: 'bg-zinc-500' },
}

export function StatusHeader({ name, state, description }: Props) {
  const info = STATE_INFO[state] ?? STATE_INFO['unknown']
  return (
    <header className="space-y-3">
      <h1 className="text-3xl font-bold text-white">{name}</h1>
      {description && <p className="text-zinc-400 text-sm">{description}</p>}
      <div className="flex items-center gap-2.5">
        <span className={`w-3 h-3 rounded-full ${info.dot} shrink-0`} />
        <span className={`text-lg font-semibold ${info.color}`}>{info.label}</span>
      </div>
    </header>
  )
}
