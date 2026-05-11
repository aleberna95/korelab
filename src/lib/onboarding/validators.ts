/**
 * Per-step validation functions.
 * Each returns true if the step is valid enough to advance.
 */
import type { WizardState } from './state'

export function validateStepClient(s: WizardState): boolean {
  if (s.clientMode === 'existing') {
    return s.existingClientId.length > 0
  }
  if (!s.client.name.trim()) return false
  if (!s.client.businessType) return false
  if (!s.client.supportPlan) return false
  if (s.client.contacts.length === 0) return false
  return s.client.contacts.every(
    (c) => c.name.trim() && c.email.includes('@') && c.role.trim(),
  )
}

export function validateStepService(s: WizardState): boolean {
  if (!s.service.name.trim()) return false
  if (!s.service.type) return false
  if (!s.service.environment) return false
  if (!s.service.criticality) return false
  return true
}

export function validateStepMonitoring(s: WizardState): boolean {
  if (!s.monitor.source) return false
  if (s.monitor.intervalSec < 30 || s.monitor.intervalSec > 3600) return false
  if (s.monitor.expectStatus < 100 || s.monitor.expectStatus > 599) return false
  return true
}

export function validateStepReview(_s: WizardState): boolean {
  return true
}

export type StepValidator = (s: WizardState) => boolean

export const STEP_VALIDATORS: Record<string, StepValidator> = {
  client: validateStepClient,
  service: validateStepService,
  monitoring: validateStepMonitoring,
  review: validateStepReview,
}

export function isCurrentStepValid(s: WizardState): boolean {
  const validator = STEP_VALIDATORS[s.currentStepId]
  return validator ? validator(s) : true
}

// ─── Payload builder ──────────────────────────────────────────────────────

export function buildSubmitPayload(s: WizardState) {
  return {
    clientMode: s.clientMode,
    existingClientId: s.clientMode === 'existing' ? s.existingClientId : undefined,

    client:
      s.clientMode === 'new'
        ? {
            name: s.client.name,
            businessType: s.client.businessType,
            contacts: s.client.contacts,
            telegramChatId: s.client.telegramChatId || undefined,
            supportPlan: s.client.supportPlan,
            consent: {
              monitoring: s.client.consentMonitoring,
              notification: s.client.consentNotification,
            },
            tags: s.client.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            notes: s.client.notes,
            status: 'active' as const,
          }
        : undefined,

    service: {
      name: s.service.name,
      type: s.service.type,
      environment: s.service.environment,
      criticality: s.service.criticality,
      tags: s.service.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      description: s.service.description,
      url: s.service.primaryUrl || undefined,
      healthcheckUrl: s.service.healthcheckUrl || undefined,
      statusPageVisibility: s.service.statusPageVisibility,
    },

    monitor: {
      source: s.monitor.source,
      config: {
        intervalSec: s.monitor.intervalSec,
        url: s.service.healthcheckUrl || s.service.primaryUrl || undefined,
        expectStatus: s.monitor.expectStatus,
        expectBody: s.monitor.expectBody || undefined,
      },
      alertChannels: {
        telegram: s.monitor.telegram,
        clientNotify: s.monitor.clientNotify,
      },
      active: true,
    },
  }
}
