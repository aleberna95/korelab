'use client'

import { useRouter } from 'next/navigation'
import { useWizard, STEP_LABELS, type StepId } from '@/lib/onboarding/state'
import { isCurrentStepValid } from '@/lib/onboarding/validators'
import { submitOnboarding } from '@/lib/onboarding/submit'
import { WizardProvider } from '@/lib/onboarding/WizardProvider'
import { StepNav } from './StepNav'
import { StepClient } from './StepClient'
import { StepServiceBasics } from './StepServiceBasics'
import { StepMonitoring } from './StepMonitoring'
import { StepAccess } from './StepAccess'
import { StepResources } from './StepResources'
import { StepVisibility } from './StepVisibility'
import { StepAutomation } from './StepAutomation'
import { StepRunbook } from './StepRunbook'
import { StepReview } from './StepReview'

export type ClientOption = { id: string; name: string; supportPlan: string }
export type RunbookOption = { id: string; title: string }

type Props = {
  clientOptions: ClientOption[]
  runbookOptions: RunbookOption[]
}

function STEP_COMPONENT(
  stepId: StepId,
  clientOptions: ClientOption[],
  runbookOptions: RunbookOption[],
) {
  switch (stepId) {
    case 'client':
      return <StepClient clientOptions={clientOptions} />
    case 'service':
      return <StepServiceBasics />
    case 'monitoring':
      return <StepMonitoring />
    case 'access':
      return <StepAccess />
    case 'resources':
      return <StepResources />
    case 'visibility':
      return <StepVisibility />
    case 'automation':
      return <StepAutomation />
    case 'runbook':
      return <StepRunbook runbookOptions={runbookOptions} />
    case 'review':
      return <StepReview />
  }
}

function WizardInner({ clientOptions, runbookOptions }: Props) {
  const { state, dispatch, activeSteps, currentIndex, goNext, goPrev } = useWizard()
  const router = useRouter()

  const isValid = isCurrentStepValid(state)
  const isFirst = currentIndex === 0
  const isLast = currentIndex === activeSteps.length - 1
  const isReview = state.currentStepId === 'review'

  async function handleSubmit() {
    dispatch({ type: 'SET_SUBMITTING', value: true })
    dispatch({ type: 'SET_SUBMIT_ERROR', error: null })

    const result = await submitOnboarding(state)

    if (result.ok) {
      // Clear session storage
      try {
        sessionStorage.removeItem('cc:onboarding:v1')
      } catch {}
      router.push(`/admin/services/${result.ids.serviceId}?onboarded=1`)
    } else {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: result.error })
      dispatch({ type: 'SET_SUBMITTING', value: false })
    }
  }

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Left: step nav */}
      <div className="w-52 shrink-0">
        <StepNav />
      </div>

      {/* Right: step content + footer */}
      <div className="flex-1 flex flex-col">
        {/* Step heading */}
        <div className="mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Step {currentIndex + 1} of {activeSteps.length}
        </div>

        {/* Step content */}
        <div className="flex-1 bg-zinc-800/60 rounded-xl border border-zinc-700 p-6">
          {STEP_COMPONENT(state.currentStepId, clientOptions, runbookOptions)}
        </div>

        {/* Submit error */}
        {state.submitError && (
          <div className="mt-3 px-4 py-2 bg-red-900/40 border border-red-700 rounded-md text-sm text-red-300">
            {state.submitError}
          </div>
        )}

        {/* Navigation footer */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={isFirst || state.isSubmitting}
            className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Reset wizard and start over?')) {
                  dispatch({ type: 'RESET' })
                }
              }}
              disabled={state.isSubmitting}
              className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              Reset
            </button>

            {isReview ? (
              <button
                onClick={handleSubmit}
                disabled={state.isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state.isSubmitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Confirm & Create'
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!isValid || isLast}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WizardShell({ clientOptions, runbookOptions }: Props) {
  return (
    <WizardProvider>
      <WizardInner clientOptions={clientOptions} runbookOptions={runbookOptions} />
    </WizardProvider>
  )
}
