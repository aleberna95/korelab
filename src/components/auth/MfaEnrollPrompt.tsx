'use client'

import { useState } from 'react'
import {
  getAuth,
  multiFactor,
  TotpMultiFactorGenerator,
} from 'firebase/auth'
import { clientApp } from '@/lib/firebase/client'

type EnrollStep = 'start' | 'scan' | 'verify' | 'done'

interface MfaEnrollPromptProps {
  onDone?: () => void
}

export function MfaEnrollPrompt({ onDone }: MfaEnrollPromptProps) {
  const [step, setStep] = useState<EnrollStep>('start')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stored between steps
  const [pendingMultiFactorSession, setPendingMultiFactorSession] =
    useState<Awaited<ReturnType<typeof TotpMultiFactorGenerator.generateSecret>> | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const auth = getAuth(clientApp)
      const user = auth.currentUser
      if (!user) throw new Error('Not authenticated')

      const mfaUser = multiFactor(user)
      const session = await mfaUser.getSession()
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session)

      const url = totpSecret.generateQrCodeUrl(
        user.email ?? 'admin',
        'CommandCenter',
      )

      setPendingMultiFactorSession(totpSecret)
      setQrCodeUrl(url)
      setSecret(totpSecret.secretKey)
      setStep('scan')
    } catch (err) {
      setError('Failed to start MFA enrollment. Make sure you are signed in.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingMultiFactorSession) return
    setLoading(true)
    setError(null)

    try {
      const auth = getAuth(clientApp)
      const user = auth.currentUser
      if (!user) throw new Error('Not authenticated')

      const mfaUser = multiFactor(user)
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        pendingMultiFactorSession,
        totpCode,
      )
      await mfaUser.enroll(assertion, 'Authenticator App')
      setStep('done')
    } catch {
      setError('Invalid code. Please check your authenticator and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'start') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Set up two-factor authentication</h2>
        <p className="text-sm text-zinc-400">
          MFA is required for admin access. Set up an authenticator app to continue.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Starting…' : 'Set up authenticator'}
        </button>
      </div>
    )
  }

  if (step === 'scan') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Scan QR code</h2>
        <p className="text-sm text-zinc-400">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </p>
        {qrCodeUrl && (
          <div className="bg-white p-3 rounded-md inline-block">
            {/* QR rendered via Google Charts API — replace with a local QR lib in production */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrCodeUrl)}`}
              alt="TOTP QR code"
              width={200}
              height={200}
            />
          </div>
        )}
        {secret && (
          <p className="text-xs text-zinc-500 font-mono break-all">
            Manual key: {secret}
          </p>
        )}
        <button
          onClick={() => setStep('verify')}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          I've scanned it →
        </button>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Enter verification code</h2>
        <p className="text-sm text-zinc-400">
          Enter the 6-digit code from your authenticator app to complete enrollment.
        </p>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
          className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm tracking-widest text-center"
          placeholder="000000"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {loading ? 'Verifying…' : 'Confirm'}
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">✓ MFA enabled</h2>
      <p className="text-sm text-zinc-400">
        Two-factor authentication is now active on your account.
      </p>
      {onDone && (
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
        >
          Continue
        </button>
      )}
    </div>
  )
}
