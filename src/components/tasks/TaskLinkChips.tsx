'use client'

import type { LinkItem } from './TaskLinkSheet'

const MAX_VISIBLE = 3

type Props = {
  clientIds: string[]
  serviceIds: string[]
  availableClients: LinkItem[]
  availableServices: LinkItem[]
  onRemoveClient?: (id: string) => void
  onRemoveService?: (id: string) => void
}

export function TaskLinkChips({
  clientIds,
  serviceIds,
  availableClients,
  availableServices,
  onRemoveClient,
  onRemoveService,
}: Props) {
  const clientsById = new Map(availableClients.map((c) => [c.id, c.name]))
  const servicesById = new Map(availableServices.map((s) => [s.id, s.name]))

  type Chip = { key: string; label: string; onRemove?: () => void }
  const chips: Chip[] = [
    ...clientIds
      .filter((id) => clientsById.has(id))
      .map((id) => ({
        key: `c:${id}`,
        label: `👤 ${clientsById.get(id)}`,
        onRemove: onRemoveClient ? () => onRemoveClient(id) : undefined,
      })),
    ...serviceIds
      .filter((id) => servicesById.has(id))
      .map((id) => ({
        key: `s:${id}`,
        label: `🧩 ${servicesById.get(id)}`,
        onRemove: onRemoveService ? () => onRemoveService(id) : undefined,
      })),
  ]

  if (chips.length === 0) return null

  const visible = chips.slice(0, MAX_VISIBLE)
  const extra = chips.length - MAX_VISIBLE

  return (
    <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
      {visible.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-black/10 text-[var(--color-fg)] max-w-[140px]"
        >
          <span className="truncate">{chip.label}</span>
          {chip.onRemove && (
            <button
              type="button"
              onClick={chip.onRemove}
              className="shrink-0 opacity-60 hover:opacity-100 leading-none"
              aria-label="Rimuovi"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center text-[11px] font-medium rounded-full px-2 py-0.5 bg-black/10 text-[var(--color-fg)]">
          +{extra}
        </span>
      )}
    </div>
  )
}
