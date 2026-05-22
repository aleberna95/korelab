import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp()
  const app = initializeApp(firebaseConfig)
  // Enable IndexedDB offline persistence — writes are queued when offline
  initializeFirestore(app, { localCache: persistentLocalCache() })
  // Eagerly initialize Auth so state is restored from IndexedDB immediately.
  // Without this, onSnapshot listeners start before auth is ready → permission-denied.
  getAuth(app)

  // Initialize App Check (browser only — reCAPTCHA v3 provider).
  //
  // Production:  set NEXT_PUBLIC_RECAPTCHA_SITE_KEY (reCAPTCHA v3 site key).
  // Local dev:   set NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN to a UUID you
  //              generated (e.g. crypto.randomUUID()) and registered once in
  //              Firebase console → App Check → your app → debug tokens.
  //              The reCAPTCHA exchange is fully bypassed when the debug token
  //              is present, so NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not needed.
  const _siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  const _debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN

  if (typeof window !== 'undefined' && (_siteKey || _debugToken)) {
    if (_debugToken) {
      // @ts-expect-error — Firebase reads this global before initializeAppCheck
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = _debugToken
    }
    // Skip reCAPTCHA-based App Check on localhost — the key is not authorized
    // for localhost and would throw a 401. Use NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN
    // (registered in Firebase Console → App Check → debug tokens) to test App Check locally.
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (!isLocalhost || _debugToken) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(_siteKey ?? 'debug-placeholder'),
        isTokenAutoRefreshEnabled: true,
      })
    }
  }

  return app
}

export const clientApp = getClientApp()

// ─── Auth readiness ──────────────────────────────────────────────────────────
// Resolves once Firebase has determined the initial auth state (user or null).
// All onSnapshot callers should await this before subscribing; otherwise the
// first Firestore request goes out unauthenticated → permission-denied.
let _authReady: Promise<void> | null = null

export function waitForAuth(): Promise<void> {
  if (!_authReady) {
    _authReady = new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(getAuth(clientApp), () => {
        unsub()
        resolve()
      })
    })
  }
  return _authReady
}
