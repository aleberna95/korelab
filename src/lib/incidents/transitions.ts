/**
 * Incident state machine — pure functions, no side effects, no imports.
 *
 * States:
 *   investigating → identified | monitoring | resolved | false-positive
 *   identified    → monitoring | resolved | false-positive
 *   monitoring    → investigating | resolved | false-positive
 *   resolved      → investigating  (re-open)
 *   false-positive → (terminal)
 *
 * Triggered automatically by the engine:
 *   down event + no active incident → create (investigating)
 *   down event + monitoring         → back to investigating
 *   up event + investigating/identified → monitoring
 *   stable up (5 min) + monitoring  → resolved  [resolveStableUp function]
 */

export type IncidentState =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'false-positive'

const ALLOWED: Record<IncidentState, IncidentState[]> = {
  investigating: ['identified', 'monitoring', 'resolved', 'false-positive'],
  identified: ['monitoring', 'resolved', 'false-positive'],
  monitoring: ['investigating', 'resolved', 'false-positive'],
  resolved: ['investigating'],
  'false-positive': [],
}

/** Whether a manual transition from → to is allowed */
export function canTransition(from: IncidentState, to: IncidentState): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export type EngineEventKind = 'up' | 'down'

/**
 * Apply an automatic engine event to the current state.
 * Returns the new state, or null if no transition applies.
 */
export function applyEngineEvent(
  current: IncidentState,
  event: EngineEventKind,
): IncidentState | null {
  if (event === 'down') {
    // Flap back: monitoring → investigating
    if (current === 'monitoring') return 'investigating'
    // Already actively tracking
    return null
  }
  if (event === 'up') {
    if (current === 'investigating' || current === 'identified') return 'monitoring'
    return null
  }
  return null
}
