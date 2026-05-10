/**
 * Cloud Functions — Command Center
 *
 * Functions are registered per-phase:
 * - Phase 4: UptimeRobot sync trigger
 * - Phase 5: Incident lifecycle (onIncidentWrite, resolveStableUp)
 * - Phase 8: dailyRollup, generateMonthlyReports
 * - Phase 10: internalChecks
 */

// Phase 4 — UptimeRobot sync
export { syncUptimeRobotMonitor } from './uptimerobot/syncMonitor'

// Phase 5 — Incident lifecycle
export { onIncidentWrite } from './incidents/onIncidentWrite'
export { resolveStableUp } from './incidents/resolveStableUp'

// Phase 8 — Reporting
export { dailyRollup } from './reporting/dailyRollup'
export { generateMonthlyReports } from './reporting/generateMonthlyReports'

// Phase 10 — Internal checks
export { internalChecks } from './checks/internalChecks'

// Cross-cutting — weekly integration health check
export { weeklyHealthCheck } from './weeklyHealthCheck'
