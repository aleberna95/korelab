import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth/guards'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { parseServiceFilters } from '@/lib/dashboard/queries'
import { ServiceTable } from '@/components/dashboard/ServiceTable'
import { FilterBar } from '@/components/dashboard/FilterBar'

export const metadata: Metadata = { title: 'Services — Command Center' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ServicesPage({ searchParams }: Props) {
  await requireAdmin()
  const params = await searchParams

  const filters = parseServiceFilters(params)
  const services = await servicesRepo.list({ ...filters, limit: 200 })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <p className="text-sm text-gray-500 mt-1">All services, filterable by state and client.</p>
      </header>

      {/* Filter bar is client component — wrap in Suspense for streaming */}
      <Suspense fallback={<div className="h-10" />}>
        <FilterBar />
      </Suspense>

      <ServiceTable services={services} />
    </div>
  )
}
