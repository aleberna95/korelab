'use client'

import { useReducer, useEffect, type ReactNode } from 'react'
import {
  WizardContext,
  SESSION_KEY,
  reducer,
  INITIAL_STATE,
  getActiveSteps,
  type WizardState,
} from './state'

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState
        dispatch({ type: 'HYDRATE', state: parsed })
      }
    } catch {
      // sessionStorage unavailable or corrupt — start fresh
    }
  }, [])

  // Persist to sessionStorage after every state change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
    } catch {
      // ignore write errors (e.g. private browsing quota)
    }
  }, [state])

  const activeSteps = getActiveSteps(state)
  const currentIndex = activeSteps.indexOf(state.currentStepId)

  function goNext() {
    const next = activeSteps[currentIndex + 1]
    if (next) dispatch({ type: 'SET_STEP', stepId: next })
  }

  function goPrev() {
    const prev = activeSteps[currentIndex - 1]
    if (prev) dispatch({ type: 'SET_STEP', stepId: prev })
  }

  return (
    <WizardContext.Provider value={{ state, dispatch, activeSteps, currentIndex, goNext, goPrev }}>
      {children}
    </WizardContext.Provider>
  )
}
