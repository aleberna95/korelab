/**
 * Derive incident severity from service criticality.
 * Pure function, no imports, safe for both server and client.
 */

export type ServiceCriticality = 'low' | 'medium' | 'high' | 'critical'
export type IncidentSeverity = 'minor' | 'major' | 'critical'

export function deriveSeverity(criticality: ServiceCriticality | string | undefined): IncidentSeverity {
  if (criticality === 'critical') return 'critical'
  if (criticality === 'high') return 'major'
  return 'minor'
}

/** Map severity to service status state */
export function severityToStatusState(
  severity: IncidentSeverity,
): 'major-outage' | 'partial-outage' | 'degraded' {
  if (severity === 'critical') return 'major-outage'
  if (severity === 'major') return 'partial-outage'
  return 'degraded'
}
