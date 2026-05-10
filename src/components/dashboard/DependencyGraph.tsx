/**
 * DependencyGraph — simple SVG rendering of a service's dependencies.
 *
 * Renders the focal service as a central node, with outbound and inbound
 * dependency nodes arranged around it. No external charting library.
 */

import type { Service, Dependency } from '@/lib/domain/types'

type DepNode = {
  id: string
  label: string
  kind: 'service' | 'resource'
  dir: 'out' | 'in'
}

type Props = {
  service: Service
  outbound: Dependency[]
  inbound: Dependency[]
  /** Map of node id → label for resolving names */
  nodeLabels: Record<string, string>
}

const SVG_W = 640
const SVG_H = 320
const CX = SVG_W / 2
const CY = SVG_H / 2
const R_FOCAL = 40
const R_NODE = 28
const ORBIT_RADIUS = 130

export function DependencyGraph({ service, outbound, inbound, nodeLabels }: Props) {
  const nodes: DepNode[] = [
    ...outbound.map((d) => ({
      id: d.toId,
      label: nodeLabels[d.toId] ?? d.toId.slice(0, 8),
      kind: d.toKind,
      dir: 'out' as const,
    })),
    ...inbound.map((d) => ({
      id: d.fromId,
      label: nodeLabels[d.fromId] ?? d.fromId.slice(0, 8),
      kind: d.fromKind,
      dir: 'in' as const,
    })),
  ]

  // Dedupe by id (a node can appear in both directions)
  const seen = new Set<string>()
  const dedupedNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })

  // Position nodes evenly around the focal node
  const positioned = dedupedNodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / dedupedNodes.length - Math.PI / 2
    return {
      ...n,
      x: CX + ORBIT_RADIUS * Math.cos(angle),
      y: CY + ORBIT_RADIUS * Math.sin(angle),
    }
  })

  if (dedupedNodes.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">No dependencies mapped.</p>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full max-h-72 border border-gray-100 rounded-lg bg-gray-50"
      aria-label="Dependency graph"
    >
      <defs>
        <marker
          id="arrowOut"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
        </marker>
        <marker
          id="arrowIn"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
        </marker>
      </defs>

      {/* Edges */}
      {positioned.map((n) => {
        const isOut = outbound.some((d) => d.toId === n.id)
        const isIn = inbound.some((d) => d.fromId === n.id)
        const color = isOut ? '#6b7280' : '#3b82f6'
        const marker = isOut ? 'url(#arrowOut)' : 'url(#arrowIn)'
        const x1 = isOut ? CX : n.x
        const y1 = isOut ? CY : n.y
        const x2 = isOut ? n.x : CX
        const y2 = isOut ? n.y : CY
        return (
          <line
            key={`edge-${n.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray={isIn ? '4 3' : undefined}
            markerEnd={marker}
            opacity={0.7}
          />
        )
      })}

      {/* Peripheral nodes */}
      {positioned.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={R_NODE}
            fill={n.kind === 'resource' ? '#ede9fe' : '#dbeafe'}
            stroke={n.kind === 'resource' ? '#7c3aed' : '#2563eb'}
            strokeWidth={1.5}
          />
          <text
            x={n.x}
            y={n.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="#374151"
            className="pointer-events-none select-none"
          >
            {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
          </text>
          <text
            x={n.x}
            y={n.y + R_NODE + 12}
            textAnchor="middle"
            fontSize={8}
            fill="#6b7280"
            className="pointer-events-none select-none"
          >
            {n.dir === 'out' ? '→ uses' : '← used by'}
          </text>
        </g>
      ))}

      {/* Focal node */}
      <circle cx={CX} cy={CY} r={R_FOCAL} fill="#2563eb" />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill="white"
        fontWeight="bold"
        className="pointer-events-none select-none"
      >
        {service.name.length > 14 ? service.name.slice(0, 13) + '…' : service.name}
      </text>
    </svg>
  )
}
