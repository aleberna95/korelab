'use client'

import { useWizard, STEP_LABELS } from '@/lib/onboarding/state'
import { STEP_VALIDATORS } from '@/lib/onboarding/validators'

export function StepNav() {
  const { state, dispatch, activeSteps, currentIndex } = useWizard()

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      {activeSteps.map((stepId, idx) => {
        const isCurrent = stepId === state.currentStepId
        const isPast = idx < currentIndex
        const validator = STEP_VALIDATORS[stepId]
        const isValid = validator ? validator(state) : true

        return (
          <button
            key={stepId}
            onClick={() => dispatch({ type: 'SET_STEP', stepId })}
            disabled={state.isSubmitting}
            className={[
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors shrink-0',
              isCurrent
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            ].join(' ')}
          >
            {/* Step indicator dot */}
            <span
              className={[
                'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : isPast && isValid
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-500',
              ].join(' ')}
            >
              {isPast && isValid ? '✓' : idx + 1}
            </span>

            <span className="truncate">{STEP_LABELS[stepId]}</span>
          </button>
        )
      })}
    </nav>
  )
}
