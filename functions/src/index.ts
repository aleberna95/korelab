/**
 * Cloud Functions — Command Center
 *
 * - internalChecks: HTTP + SSL health checks (every 15 min)
 * - onIncidentWrite: Telegram alert on incident state change
 * - resolveStableUp: auto-resolve incidents after stable uptime
 * - weeklyHealthCheck: weekly integration health ping
 * - generateQuotePdf: render & upload a quote PDF (callable, admin only)
 */

export { internalChecks } from './checks/internalChecks'
export { onIncidentWrite } from './incidents/onIncidentWrite'
export { resolveStableUp } from './incidents/resolveStableUp'
export { weeklyHealthCheck } from './weeklyHealthCheck'
export { generateQuotePdf } from './quotes/generatePdf'
export { onQuoteWrite } from './quotes/onQuoteWrite'
