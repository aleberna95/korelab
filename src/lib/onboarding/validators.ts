/**
 * Per-step validation functions.
 * Each returns true if the step is valid enough to advance.
 * These run on the client only — Zod validation on the payload
 * runs again server-side in the API route before any writes.
 */
import type { WizardState } from './state'
import { getEffectiveSupportPlan } from './state'

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

export function validateStepAccess(_s: WizardState): boolean {
  // All fields optional; access.level has a default
  return true
}

export function validateStepResources(_s: WizardState): boolean {
  return true // Optional step — always valid
}

export function validateStepVisibility(s: WizardState): boolean {
  const validStatusPage = ['private', 'tokenized', 'public'].includes(s.visibility.statusPage)
  const validReportSharing = ['private', 'tokenized', 'email'].includes(s.visibility.reportSharing)
  return validStatusPage && validReportSharing
}

export function validateStepAutomation(_s: WizardState): boolean {
  return true // mode is always forced to 'disabled' on write
}

export function validateStepRunbook(s: WizardState): boolean {
  if (s.runbookMode === 'none') return true
  if (s.runbookMode === 'existing') return s.existingRunbookId.length > 0
  return s.runbook.title.trim().length > 0
}

export function validateStepReview(_s: WizardState): boolean {
  return true // Always valid — user just confirms
}

export type StepValidator = (s: WizardState) => boolean

export const STEP_VALIDATORS: Record<string, StepValidator> = {
  client: validateStepClient,
  service: validateStepService,
  monitoring: validateStepMonitoring,
  access: validateStepAccess,
  resources: validateStepResources,
  visibility: validateStepVisibility,
  automation: validateStepAutomation,
  runbook: validateStepRunbook,
  review: validateStepReview,
}

export function isCurrentStepValid(s: WizardState): boolean {
  const validator = STEP_VALIDATORS[s.currentStepId]
  return validator ? validator(s) : true
}

// ─── Payload builder (used by submit.ts) ─────────────────────────────────

export function buildSubmitPayload(s: WizardState) {
  const plan = getEffectiveSupportPlan(s)
  const includeMonitor = plan !== 'none'
  const includeAccess = !['none', 'reporting-only'].includes(plan)

  return {
    clientMode: s.clientMode,
    existingClientId: s.clientMode === 'existing' ? s.existingClientId : undefined,
    existingClientSupportPlan:
      s.clientMode === 'existing' ? s.existingClientSupportPlan : undefined,

    client:
      s.clientMode === 'new'
        ? {
            name: s.client.name,
            businessType: s.client.businessType,
            contacts: s.client.contacts,
            notificationPrefs: {
              email: s.client.notificationEmail,
              emails: s.client.notificationEmails
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean),
              telegramChatId: s.client.telegramChatId || undefined,
            },
            supportPlan: s.client.supportPlan,
            consent: {
              monitoring: s.client.consentMonitoring,
              notification: s.client.consentNotification,
              intervention: s.client.consentIntervention,
              autoHealing: s.client.consentAutoHealing,
            },
            contractUrl: s.client.contractUrl || undefined,
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
      urls: {
        primary: s.service.primaryUrl || undefined,
        admin: s.service.adminUrl || undefined,
        healthcheck: s.service.healthcheckUrl || undefined,
        docs: s.service.docsUrl || undefined,
      },
      access: includeAccess
        ? {
            level: s.access.level,
            providers: s.access.providers
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean),
            notes: s.access.notes,
          }
        : { level: 'none', providers: [], notes: '' },
      visibility: {
        statusPage: s.visibility.statusPage,
        reportSharing: s.visibility.reportSharing,
      },
    },

    monitor: includeMonitor
      ? {
          source: s.monitor.source,
          config: {
            intervalSec: s.monitor.intervalSec,
            url: s.service.healthcheckUrl || s.service.primaryUrl || undefined,
            expectStatus: s.monitor.expectStatus,
            expectBody: s.monitor.expectBody || undefined,
          },
          alertChannels: {
            telegram: s.monitor.telegram,
            email: s.monitor.email,
            clientNotify: s.monitor.clientNotify,
          },
          active: true,
        }
      : undefined,

    secretManagerRefs: includeAccess
      ? s.access.secretManagerRefs
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean)
      : [],

    resources: s.resources.map((r) => ({
      kind: r.kind,
      name: r.name,
      metadata: (() => {
        try {
          return JSON.parse(r.metadata)
        } catch {
          return {}
        }
      })(),
      tags: [] as string[],
      secretRefIds: [] as string[],
    })),

    runbookMode: s.runbookMode,
    existingRunbookId:
      s.runbookMode === 'existing' ? s.existingRunbookId : undefined,
    runbook:
      s.runbookMode === 'new'
        ? {
            title: s.runbook.title,
            firstChecks: s.runbook.firstChecks
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
            contacts: s.runbook.contacts
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
            commonFailures: s.runbook.commonFailures,
            recoverySteps: s.runbook.recoverySteps,
            notes: s.runbook.notes,
            links: [] as string[],
            serviceTypes: [s.service.type],
            appliesToTags: [] as string[],
          }
        : undefined,
  }
}
