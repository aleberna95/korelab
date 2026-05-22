import type { SerializedTask } from '@/lib/repos/tasksSnapshot'

export interface ExportLookups {
  clients: Map<string, string>
  services: Map<string, string>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function taskLines(t: SerializedTask, lookups: ExportLookups): string[] {
  const check = t.done ? '[x]' : '[ ]'
  const lines = [`- ${check} ${t.text} \`(${t.color})\``]
  const clients = (t.clientIds ?? []).map((id) => lookups.clients.get(id) ?? id)
  const services = (t.serviceIds ?? []).map((id) => lookups.services.get(id) ?? id)
  if (clients.length) lines.push(`  - clienti: ${clients.join(', ')}`)
  if (services.length) lines.push(`  - servizi: ${services.join(', ')}`)
  return lines
}

export function toMarkdown(
  tasks: SerializedTask[],
  lookups: ExportLookups,
  includeDone = false,
): string {
  const active = tasks.filter((t) => !t.done).sort((a, b) => b.order - a.order)
  const done = includeDone ? tasks.filter((t) => t.done).sort((a, b) => b.order - a.order) : []

  const lines: string[] = [`# Note KoreLab — ${today()}`, '']

  // In corso (no client links)
  const incorso = active.filter((t) => !t.clientIds.length)
  if (incorso.length) {
    lines.push('## In corso', '')
    for (const t of incorso) lines.push(...taskLines(t, lookups))
    lines.push('')
  }

  // Per-client sections
  const byClient = new Map<string, SerializedTask[]>()
  for (const t of active) {
    for (const cid of t.clientIds) {
      if (!byClient.has(cid)) byClient.set(cid, [])
      byClient.get(cid)!.push(t)
    }
  }
  for (const [cid, clientTasks] of byClient) {
    const name = lookups.clients.get(cid) ?? cid
    lines.push(`## ${name}`, '')
    for (const t of clientTasks) lines.push(...taskLines(t, lookups))
    lines.push('')
  }

  // Done
  if (done.length) {
    lines.push('## Fatte', '')
    for (const t of done) lines.push(...taskLines(t, lookups))
    lines.push('')
  }

  return lines.join('\n')
}

/** RFC 4180 CSV field escaping */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function toCsv(
  tasks: SerializedTask[],
  lookups: ExportLookups,
  includeDone = false,
): string {
  const filtered = (includeDone ? tasks : tasks.filter((t) => !t.done))
    .sort((a, b) => b.order - a.order)

  const header = ['id', 'text', 'color', 'done', 'clientIds', 'serviceIds', 'createdAt', 'updatedAt']
  const rows = filtered.map((t) => [
    t.id,
    t.text,
    t.color,
    t.done ? 'true' : 'false',
    (t.clientIds ?? []).map((id) => lookups.clients.get(id) ?? id).join('; '),
    (t.serviceIds ?? []).map((id) => lookups.services.get(id) ?? id).join('; '),
    new Date(t.createdAtMs).toISOString(),
    new Date(t.updatedAtMs).toISOString(),
  ])

  return [header, ...rows]
    .map((row) => row.map(csvField).join(','))
    .join('\r\n')
}

export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
