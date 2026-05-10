'use client'

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
} from 'react'

// ─── Step IDs ──────────────────────────────────────────────────────────────

export type StepId =
  | 'client'
  | 'service'
  | 'monitoring'
  | 'access'
  | 'resources'
  | 'visibility'
  | 'automation'
  | 'runbook'
  | 'review'

export const STEP_LABELS: Record<StepId, string> = {
  client: 'Cliente',
  service: 'Servizio',
  monitoring: 'Monitoraggio',
  access: 'Accesso',
  resources: 'Risorse',
  visibility: 'Visibilità',
  automation: 'Automazione',
  runbook: 'Runbook',
  review: 'Riepilogo e conferma',
}

// ─── State shape ───────────────────────────────────────────────────────────

export type WizardContact = {
  name: string
  email: string
  phone: string
  role: string
  primary: boolean
}

export type WizardResource = {
  kind: string
  name: string
  metadata: string // JSON string — parsed on submit
}

export type WizardCommonFailure = {
  symptom: string
  likelyCause: string
  fix: string
}

export type WizardRecoveryStep = {
  title: string
  body: string
  riskLevel: 'low' | 'medium' | 'high'
}

export type WizardState = {
  currentStepId: StepId

  // ── Step 1: Client ──
  clientMode: 'new' | 'existing'
  existingClientId: string
  existingClientSupportPlan: string // tracked to drive conditional steps
  client: {
    name: string
    businessType: string
    contacts: WizardContact[]
    notificationEmail: boolean
    notificationEmails: string // comma-separated
    telegramChatId: string
    supportPlan: string
    consentMonitoring: boolean
    consentNotification: boolean
    consentIntervention: boolean
    consentAutoHealing: boolean
    contractUrl: string
    tags: string // comma-separated
    notes: string
  }

  // ── Step 2: Service ──
  service: {
    name: string
    type: string
    environment: string
    criticality: string
    tags: string // comma-separated
    description: string
    primaryUrl: string
    adminUrl: string
    healthcheckUrl: string
    docsUrl: string
  }

  // ── Step 3: Monitoring ──
  monitor: {
    source: string
    intervalSec: number
    expectStatus: number
    expectBody: string
    telegram: boolean
    email: boolean
    clientNotify: boolean
  }

  // ── Step 4: Access ──
  access: {
    level: string
    providers: string // comma-separated
    notes: string
    secretManagerRefs: string // newline-separated — Secret Manager resource names only
  }

  // ── Step 5: Resources ──
  resources: WizardResource[]

  // ── Step 6: Visibility ──
  visibility: {
    statusPage: string
    reportSharing: string
  }

  // ── Step 7: Automation ──
  automation: {
    mode: string // always forced to 'disabled' on submit in MVP
  }

  // ── Step 8: Runbook ──
  runbookMode: 'none' | 'existing' | 'new'
  existingRunbookId: string
  runbook: {
    title: string
    firstChecks: string // newline-separated
    contacts: string // newline-separated
    notes: string
    commonFailures: WizardCommonFailure[]
    recoverySteps: WizardRecoveryStep[]
  }

  // ── Submit state ──
  isSubmitting: boolean
  submitError: string | null
}

// ─── Initial state ─────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  currentStepId: 'client',

  clientMode: 'new',
  existingClientId: '',
  existingClientSupportPlan: '',
  client: {
    name: '',
    businessType: '',
    contacts: [],
    notificationEmail: true,
    notificationEmails: '',
    telegramChatId: '',
    supportPlan: 'monitor-only',
    consentMonitoring: true,
    consentNotification: true,
    consentIntervention: false,
    consentAutoHealing: false,
    contractUrl: '',
    tags: '',
    notes: '',
  },

  service: {
    name: '',
    type: '',
    environment: 'production',
    criticality: 'medium',
    tags: '',
    description: '',
    primaryUrl: '',
    adminUrl: '',
    healthcheckUrl: '',
    docsUrl: '',
  },

  monitor: {
    source: 'internal-http',
    intervalSec: 60,
    expectStatus: 200,
    expectBody: '',
    telegram: true,
    email: false,
    clientNotify: false,
  },

  access: {
    level: 'none',
    providers: '',
    notes: '',
    secretManagerRefs: '',
  },

  resources: [],

  visibility: {
    statusPage: 'private',
    reportSharing: 'private',
  },

  automation: {
    mode: 'disabled',
  },

  runbookMode: 'none',
  existingRunbookId: '',
  runbook: {
    title: '',
    firstChecks: '',
    contacts: '',
    notes: '',
    commonFailures: [],
    recoverySteps: [],
  },

  isSubmitting: false,
  submitError: null,
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'SET_STEP'; stepId: StepId }
  | { type: 'SET_CLIENT_MODE'; mode: 'new' | 'existing' }
  | { type: 'SET_EXISTING_CLIENT'; id: string; supportPlan: string }
  | { type: 'UPDATE_CLIENT'; patch: Partial<WizardState['client']> }
  | { type: 'UPDATE_SERVICE'; patch: Partial<WizardState['service']> }
  | { type: 'UPDATE_MONITOR'; patch: Partial<WizardState['monitor']> }
  | { type: 'UPDATE_ACCESS'; patch: Partial<WizardState['access']> }
  | { type: 'ADD_RESOURCE'; resource: WizardResource }
  | { type: 'REMOVE_RESOURCE'; index: number }
  | { type: 'UPDATE_VISIBILITY'; patch: Partial<WizardState['visibility']> }
  | { type: 'UPDATE_AUTOMATION'; patch: Partial<WizardState['automation']> }
  | { type: 'SET_RUNBOOK_MODE'; mode: 'none' | 'existing' | 'new' }
  | { type: 'SET_EXISTING_RUNBOOK'; id: string }
  | { type: 'UPDATE_RUNBOOK'; patch: Partial<WizardState['runbook']> }
  | { type: 'ADD_COMMON_FAILURE'; failure: WizardCommonFailure }
  | { type: 'REMOVE_COMMON_FAILURE'; index: number }
  | { type: 'ADD_RECOVERY_STEP'; step: WizardRecoveryStep }
  | { type: 'REMOVE_RECOVERY_STEP'; index: number }
  | { type: 'ADD_CONTACT'; contact: WizardContact }
  | { type: 'REMOVE_CONTACT'; index: number }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'SET_SUBMIT_ERROR'; error: string | null }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: WizardState }

// ─── Reducer ───────────────────────────────────────────────────────────────

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStepId: action.stepId }
    case 'SET_CLIENT_MODE':
      return { ...state, clientMode: action.mode }
    case 'SET_EXISTING_CLIENT':
      return {
        ...state,
        existingClientId: action.id,
        existingClientSupportPlan: action.supportPlan,
      }
    case 'UPDATE_CLIENT':
      return { ...state, client: { ...state.client, ...action.patch } }
    case 'UPDATE_SERVICE':
      return { ...state, service: { ...state.service, ...action.patch } }
    case 'UPDATE_MONITOR':
      return { ...state, monitor: { ...state.monitor, ...action.patch } }
    case 'UPDATE_ACCESS':
      return { ...state, access: { ...state.access, ...action.patch } }
    case 'ADD_RESOURCE':
      return { ...state, resources: [...state.resources, action.resource] }
    case 'REMOVE_RESOURCE':
      return { ...state, resources: state.resources.filter((_, i) => i !== action.index) }
    case 'UPDATE_VISIBILITY':
      return { ...state, visibility: { ...state.visibility, ...action.patch } }
    case 'UPDATE_AUTOMATION':
      return { ...state, automation: { ...state.automation, ...action.patch } }
    case 'SET_RUNBOOK_MODE':
      return { ...state, runbookMode: action.mode }
    case 'SET_EXISTING_RUNBOOK':
      return { ...state, existingRunbookId: action.id }
    case 'UPDATE_RUNBOOK':
      return { ...state, runbook: { ...state.runbook, ...action.patch } }
    case 'ADD_COMMON_FAILURE':
      return {
        ...state,
        runbook: {
          ...state.runbook,
          commonFailures: [...state.runbook.commonFailures, action.failure],
        },
      }
    case 'REMOVE_COMMON_FAILURE':
      return {
        ...state,
        runbook: {
          ...state.runbook,
          commonFailures: state.runbook.commonFailures.filter((_, i) => i !== action.index),
        },
      }
    case 'ADD_RECOVERY_STEP':
      return {
        ...state,
        runbook: {
          ...state.runbook,
          recoverySteps: [...state.runbook.recoverySteps, action.step],
        },
      }
    case 'REMOVE_RECOVERY_STEP':
      return {
        ...state,
        runbook: {
          ...state.runbook,
          recoverySteps: state.runbook.recoverySteps.filter((_, i) => i !== action.index),
        },
      }
    case 'ADD_CONTACT':
      return {
        ...state,
        client: { ...state.client, contacts: [...state.client.contacts, action.contact] },
      }
    case 'REMOVE_CONTACT':
      return {
        ...state,
        client: {
          ...state.client,
          contacts: state.client.contacts.filter((_, i) => i !== action.index),
        },
      }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.value }
    case 'SET_SUBMIT_ERROR':
      return { ...state, submitError: action.error }
    case 'RESET':
      return INITIAL_STATE
    case 'HYDRATE':
      return { ...action.state, isSubmitting: false, submitError: null }
    default:
      return state
  }
}

// ─── Derived helpers ───────────────────────────────────────────────────────

export function getEffectiveSupportPlan(state: WizardState): string {
  return state.clientMode === 'existing'
    ? state.existingClientSupportPlan
    : state.client.supportPlan
}

export function getActiveSteps(state: WizardState): StepId[] {
  const plan = getEffectiveSupportPlan(state)
  const steps: StepId[] = ['client', 'service']

  // Monitoring: skipped only if supportPlan === 'none'
  if (plan !== 'none') {
    steps.push('monitoring')
  }

  // Access: skipped if plan is 'none' or 'reporting-only'
  if (!['none', 'reporting-only'].includes(plan)) {
    steps.push('access')
  }

  steps.push('resources', 'visibility')

  // Automation: only if auto-healing plan AND consent
  const autoHealingConsented =
    state.clientMode === 'new' && state.client.consentAutoHealing
  if (plan === 'auto-healing' && autoHealingConsented) {
    steps.push('automation')
  }

  steps.push('runbook', 'review')
  return steps
}

// ─── Context ───────────────────────────────────────────────────────────────

type WizardContextValue = {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  activeSteps: StepId[]
  currentIndex: number
  goNext: () => void
  goPrev: () => void
}

export const WizardContext = createContext<WizardContextValue | null>(null)

export const SESSION_KEY = 'cc:onboarding:v1'

export { reducer, INITIAL_STATE }

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used inside WizardProvider')
  return ctx
}
