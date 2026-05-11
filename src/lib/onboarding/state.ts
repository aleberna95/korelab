'use client'

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
} from 'react'

// ─── Step IDs ──────────────────────────────────────────────────────────────

export type StepId = 'client' | 'service' | 'monitoring' | 'review'

export const STEP_LABELS: Record<StepId, string> = {
  client: 'Cliente',
  service: 'Servizio',
  monitoring: 'Monitor',
  review: 'Riepilogo',
}

export const ALL_STEPS: StepId[] = ['client', 'service', 'monitoring', 'review']

// ─── State shape ───────────────────────────────────────────────────────────

export type WizardContact = {
  name: string
  email: string
  phone: string
  role: string
  primary: boolean
}

export type WizardState = {
  currentStepId: StepId

  // ── Step 1: Client ──
  clientMode: 'new' | 'existing'
  existingClientId: string
  client: {
    name: string
    businessType: string
    contacts: WizardContact[]
    telegramChatId: string
    supportPlan: string
    consentMonitoring: boolean
    consentNotification: boolean
    tags: string
    notes: string
  }

  // ── Step 2: Service ──
  service: {
    name: string
    type: string
    environment: string
    criticality: string
    tags: string
    description: string
    primaryUrl: string
    healthcheckUrl: string
    statusPageVisibility: string
  }

  // ── Step 3: Monitoring ──
  monitor: {
    source: string
    intervalSec: number
    expectStatus: number
    expectBody: string
    telegram: boolean
    clientNotify: boolean
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
  client: {
    name: '',
    businessType: '',
    contacts: [],
    telegramChatId: '',
    supportPlan: 'monitor-only',
    consentMonitoring: true,
    consentNotification: true,
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
    healthcheckUrl: '',
    statusPageVisibility: 'private',
  },

  monitor: {
    source: 'internal-http',
    intervalSec: 60,
    expectStatus: 200,
    expectBody: '',
    telegram: true,
    clientNotify: false,
  },

  isSubmitting: false,
  submitError: null,
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'SET_STEP'; stepId: StepId }
  | { type: 'SET_CLIENT_MODE'; mode: 'new' | 'existing' }
  | { type: 'SET_EXISTING_CLIENT'; id: string }
  | { type: 'UPDATE_CLIENT'; patch: Partial<WizardState['client']> }
  | { type: 'UPDATE_SERVICE'; patch: Partial<WizardState['service']> }
  | { type: 'UPDATE_MONITOR'; patch: Partial<WizardState['monitor']> }
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
      return { ...state, existingClientId: action.id }
    case 'UPDATE_CLIENT':
      return { ...state, client: { ...state.client, ...action.patch } }
    case 'UPDATE_SERVICE':
      return { ...state, service: { ...state.service, ...action.patch } }
    case 'UPDATE_MONITOR':
      return { ...state, monitor: { ...state.monitor, ...action.patch } }
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
