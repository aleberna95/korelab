import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { IncidentDetail } from '@/components/incidents/IncidentDetail'

export const metadata: Metadata = { title: 'Incident — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function IncidentPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [incident, timeline] = await Promise.all([
    incidentsRepo.getById(id),
    incidentsRepo.getTimeline(id),
  ])

  if (!incident) notFound()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/admin/incidents" className="hover:underline">
          Incidents
        </Link>{' '}
        / <span className="text-gray-900">{incident.title}</span>
      </nav>

      <IncidentDetail incident={incident} initialTimeline={timeline} />
    </div>
  )
}
