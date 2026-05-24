'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { clientApp } from '@/lib/firebase/client'
import { initAppCheck } from '@/lib/firebase/appcheck'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function exchangeIdToken(idToken: string, remember: boolean): Promise<void> {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, rememberMe: remember }),
    })
    if (!res.ok) throw new Error('Session creation failed')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    initAppCheck()
    try {
      const auth = getAuth(clientApp)
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await credential.user.getIdToken()
      await exchangeIdToken(idToken, rememberMe)
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Email o password non validi.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setResetMessage({ type: 'error', text: 'Inserisci prima la tua email.' })
      return
    }
    setResetLoading(true)
    setResetMessage(null)
    try {
      const auth = getAuth(clientApp)
      await sendPasswordResetEmail(auth, email)
      setResetMessage({ type: 'ok', text: 'Email di recupero inviata. Controlla la casella.' })
    } catch {
      setResetMessage({ type: 'error', text: 'Impossibile inviare l\'email. Verifica l\'indirizzo.' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
        <p className="mt-1 text-sm text-gray-500">Alessio Bernardini — Accesso Admin</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {resetLoading ? 'Invio…' : 'Hai dimenticato la password?'}
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
          </div>

          {resetMessage && (
            <p className={`text-xs ${resetMessage.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {resetMessage.text}
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="remember-me" className="text-sm text-gray-600 select-none cursor-pointer">
              Ricordami per 5 giorni
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2"
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
    </div>
  )
}
