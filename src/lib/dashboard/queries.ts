import 'server-only'
import { servicesRepo } from '@/lib/repos/servicesRepo'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { cached, CACHE_TAGS } from '@/lib/cache'
import type { Service, ServiceStatusState } from '@/lib/domain/types'

export type OverviewStats = {
  byState: Record<ServiceStatusState, number>
  total: number
  activeIncidents: Awaited<ReturnType<typeof incidentsRepo.listActive>>
  withoutCheck: Service[]
}

/** Fetch all data needed for the overview page in one Promise.all */
export async function getOverviewStats(): Promise<OverviewStats> {
  const [allServices, activeIncidents, withoutCheck] = await Promise.all([
    cached(
      () => servicesRepo.list({ limit: 500 }),
      ['overview', 'services'],
      { tags: [CACHE_TAGS.services], revalidate: 30 },
    ),
    cached(
      () => incidentsRepo.listActive(),
      ['overview', 'active-incidents'],
      { tags: [CACHE_TAGS.incidents], revalidate: 15 },
    ),
    cached(
      () => servicesRepo.listWithoutCheck(),
      ['overview', 'no-check'],
      { tags: [CACHE_TAGS.services], revalidate: 60 },
    ),
  ])

  const byState: Record<ServiceStatusState, number> = {
    operational: 0,
    degraded: 0,
    'partial-outage': 0,
    'major-outage': 0,
    maintenance: 0,
    unknown: 0,
  }

  for (const svc of allServices) {
    const s = svc.currentStatus.state as ServiceStatusState
    byState[s] = (byState[s] ?? 0) + 1
  }

  return {
    byState,
    total: allServices.length,
    activeIncidents,
    withoutCheck,
  }
}

/**
 * Parse URL search params into ServiceFilters.
 * Used by /admin/services page — params come from Next.js searchParams.
 */
export function parseServiceFilters(
  params: Record<string, string | string[] | undefined>,
) {
  const str = (k: string) => {
    const v = params[k]
    return typeof v === 'string' ? v : undefined
  }

  const env = str('env') as Service['environment'] | undefined
  const state = str('state') as ServiceStatusState | undefined
  const criticality = str('criticality') as Service['criticality'] | undefined
  const client = str('client')
  const tag = str('tag')
  const filter = str('filter')

  return {
    clientId: client,
    environment: env,
    state,
    criticality,
    tag,
    hasNoCheck: filter === 'no-check' ? true : undefined,
    hasActiveIncident: filter === 'active-incident' ? true : undefined,
  }
}
