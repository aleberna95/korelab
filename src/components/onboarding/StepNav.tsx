'use client'

import { useWizard, STEP_LABELS } from '@/lib/onboarding/state'
import { STEP_VALIDATORS } from '@/lib/onboarding/validators'

export function StepNav() {
  const { state, dispatch, activeSteps, currentIndex } = useWizard()

  return (
    <nav className="space-y-0.5">
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
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors',
              isCurrent
                ? 'bg-zinc-700 text-white font-medium'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
            ].join(' ')}
          >
            {/* Step indicator dot */}
            <span
              className={[
                'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                isCurrent
                  ? 'bg-indigo-600 text-white'
                  : isPast && isValid
                    ? 'bg-green-700 text-white'
                    : 'bg-zinc-700 text-zinc-400',
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
