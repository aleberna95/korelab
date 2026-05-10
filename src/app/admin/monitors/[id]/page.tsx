import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { monitorsRepo } from '@/lib/repos/monitorsRepo'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { MonitorEditForm, type MonitorData } from './MonitorEditForm'

export const metadata: Metadata = { title: 'Monitor — Command Center' }

type Props = { params: Promise<{ id: string }> }

export default async function MonitorDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const monitor = await monitorsRepo.getById(id)
  if (!monitor) notFound()

  const service = await servicesRepo.getById(monitor.serviceId)
  const serviceName = service?.name ?? monitor.serviceId

  // Serialize: pass only plain-object fields (no Timestamp instances)
  const monitorData: MonitorData = {
    id: monitor.id,
    source: monitor.source,
    active: monitor.active,
    lastResult: monitor.lastResult ?? null,
    config: {
      url: monitor.config.url,
      intervalSec: monitor.config.intervalSec,
      timeoutMs: monitor.config.timeoutMs,
      expectStatus: monitor.config.expectStatus,
      expectBody: monitor.config.expectBody,
    },
    alertChannels: {
      telegram: monitor.alertChannels.telegram,
      email: monitor.alertChannels.email,
      clientNotify: monitor.alertChannels.clientNotify,
    },
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/admin/monitors" className="text-sm text-gray-500 hover:text-gray-700">
          ← Monitors
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900 capitalize">
          {monitor.source.replace(/-/g, ' ')} Monitor
        </h1>
      </div>

      <MonitorEditForm monitor={monitorData} serviceName={serviceName} />
    </div>
  )
}
