/**
 * Cloud Functions — Command Center
 *
 * - internalChecks: HTTP + SSL health checks (every 15 min)
 * - onIncidentWrite: Telegram alert on incident state change
 * - resolveStableUp: auto-resolve incidents after stable uptime
 * - weeklyHealthCheck: weekly integration health ping
 */

export { internalChecks } from './checks/internalChecks'
export { onIncidentWrite } from './incidents/onIncidentWrite'
export { resolveStableUp } from './incidents/resolveStableUp'
export { weeklyHealthCheck } from './weeklyHealthCheck'
