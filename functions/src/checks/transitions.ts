/**
 * transitions.ts — Pure HTTP check transition logic.
 *
 * No I/O, no Firebase. Exported for unit testing.
 */

import type { ServiceCheck, ServiceStatusState } from '../lib/types'
import type { HttpCheckResult } from './http'

export type HttpAction =
  | { type: 'none' }
  | { type: 'open_incident'; title: string }
  | { type: 'close_incident' }

/**
 * Determines what Firestore action to take based on HTTP result + current state.
 * Pure function — no I/O.
 *
 *  UP + operational  → none          (steady up, zero writes)
 *  UP + major-outage → close_incident (recovery)
 *  down/degraded + not major-outage → open_incident (new outage)
 *  down/degraded + major-outage     → none          (still down, zero writes)
 */
export function determineHttpAction(
  result: HttpCheckResult['result'],
  currentState: ServiceStatusState,
  check: ServiceCheck,
  error?: string,
): HttpAction {
  if (result === 'up') {
    if (currentState === 'major-outage') return { type: 'close_incident' }
    return { type: 'none' }
  }
  // 'down' or 'degraded' → both trigger an outage incident
  if (currentState !== 'major-outage') {
    return {
      type: 'open_incident',
      title: error
        ? `HTTP check failed — ${check.url}`
        : `HTTP check degraded — ${check.url}`,
    }
  }
  return { type: 'none' }
}
