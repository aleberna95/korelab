import type { WizardState } from './state'
import { buildSubmitPayload } from './validators'

export type OnboardingIds = {
  clientId: string
  serviceId: string
  monitorId?: string
  runbookId?: string
  resourceIds: string[]
}

export type OnboardingResult =
  | { ok: true; ids: OnboardingIds }
  | { ok: false; error: string }

export async function submitOnboarding(state: WizardState): Promise<OnboardingResult> {
  const payload = buildSubmitPayload(state)

  let res: Response
  try {
    res = await fetch('/api/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, error: 'Network error — please try again.' }
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: `Server error (${res.status})` }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Server error (${res.status})`
    return { ok: false, error: msg }
  }

  return data as OnboardingResult
}
