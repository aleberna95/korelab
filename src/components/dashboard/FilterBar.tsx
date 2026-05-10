'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const ENVIRONMENTS = ['production', 'staging', 'dev']
const STATES = ['operational', 'degraded', 'partial-outage', 'major-outage', 'maintenance', 'unknown']
const CRITICALITIES = ['critical', 'high', 'medium', 'low']

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      router.push(`${pathname}?${next.toString()}`)
    },
    [router, pathname, params],
  )

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Environment */}
      <select
        value={params.get('env') ?? ''}
        onChange={(e) => update('env', e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Tutti gli ambienti</option>
        {ENVIRONMENTS.map((e) => (
          <option key={e} value={e} className="capitalize">
            {e}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        value={params.get('state') ?? ''}
        onChange={(e) => update('state', e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Tutti gli stati</option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/-/g, ' ')}
          </option>
        ))}
      </select>

      {/* Criticality */}
      <select
        value={params.get('criticality') ?? ''}
        onChange={(e) => update('criticality', e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Tutte le criticità</option>
        {CRITICALITIES.map((c) => (
          <option key={c} value={c} className="capitalize">
            {c}
          </option>
        ))}
      </select>

      {/* Quick filters */}
      <select
        value={params.get('filter') ?? ''}
        onChange={(e) => update('filter', e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Nessun filtro speciale</option>
        <option value="no-monitor">Senza monitor</option>
        <option value="no-access">Senza accesso configurato</option>
        <option value="active-incident">Incidente attivo</option>
      </select>

      {/* Clear */}
      {params.toString() && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Azzera filtri
        </button>
      )}
    </div>
  )
}
