'use client'

// App Check must only run in the browser.
// This module is imported lazily from client components only.
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { clientApp } from './client'

let initialized = false

export function initAppCheck(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    console.warn('[AppCheck] NEXT_PUBLIC_RECAPTCHA_SITE_KEY not set — App Check disabled')
    return
  }

  initializeAppCheck(clientApp, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
