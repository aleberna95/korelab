'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAuth,
  signInWithEmailAndPassword,
  multiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  type MultiFactorError,
} from 'firebase/auth'
import { clientApp } from '@/lib/firebase/client'
import { initAppCheck } from '@/lib/firebase/appcheck'

type LoginStep = 'credentials' | 'totp' | 'error'

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stored between steps for MFA resolution
  const [mfaResolver, setMfaResolver] = useState<ReturnType<typeof getMultiFactorResolver> | null>(null)

  async function exchangeIdToken(idToken: string): Promise<void> {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) throw new Error('Session creation failed')
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Ensure App Check is initialized before any Firebase auth call
    initAppCheck()

    try {
      const auth = getAuth(clientApp)
      const credential = await signInWithEmailAndPassword(auth, email, password)
      // No MFA enrolled — create session directly
      const idToken = await credential.user.getIdToken()
      await exchangeIdToken(idToken)
      router.push('/admin')
      router.refresh()
    } catch (err: unknown) {
      const firebaseError = err as MultiFactorError
      if (firebaseError?.code === 'auth/multi-factor-auth-required') {
        const auth = getAuth(clientApp)
        const resolver = getMultiFactorResolver(auth, firebaseError)
        setMfaResolver(resolver)
        setStep('totp')
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaResolver) return
    setLoading(true)
    setError(null)

    try {
      const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(
        mfaResolver.hints[0].uid,
        totpCode,
      )
      const credential = await mfaResolver.resolveSignIn(multiFactorAssertion)
      const idToken = await credential.user.getIdToken()
      await exchangeIdToken(idToken)
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Invalid verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Command Center</h1>
        <p className="mt-1 text-sm text-zinc-400">Alessio Bernardini — Admin Access</p>
      </div>

      {step === 'credentials' && (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {step === 'totp' && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <p className="text-sm text-zinc-300">
            Enter the 6-digit code from your authenticator app.
          </p>
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-zinc-300 mb-1">
              Verification code
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm tracking-widest text-center"
              placeholder="000000"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('credentials'); setError(null) }}
            className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>
        </form>
      )}
    </div>
  )
}
