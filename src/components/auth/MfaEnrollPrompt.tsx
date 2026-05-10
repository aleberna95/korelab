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
      setError('Impossibile avviare la configurazione MFA. Assicurati di essere connesso.')
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
      setError('Codice non valido. Controlla la tua app di autenticazione e riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'start') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Configura l'autenticazione a due fattori</h2>
        <p className="text-sm text-zinc-400">
          L'MFA è richiesta per l'accesso admin. Configura un'app di autenticazione per continuare.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Avvio…' : 'Configura autenticatore'}
        </button>
      </div>
    )
  }

  if (step === 'scan') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Scansiona il codice QR</h2>
        <p className="text-sm text-zinc-400">
          Scansiona questo codice QR con la tua app di autenticazione (Google Authenticator, Authy, ecc.)
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
            Chiave manuale: {secret}
          </p>
        )}
        <button
          onClick={() => setStep('verify')}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          Ho scansionato →
        </button>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Inserisci il codice di verifica</h2>
        <p className="text-sm text-zinc-400">
          Inserisci il codice a 6 cifre dalla tua app per completare la configurazione.
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
          {loading ? 'Verifica in corso…' : 'Conferma'}
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">✓ MFA attiva</h2>
      <p className="text-sm text-zinc-400">
        L'autenticazione a due fattori è ora attiva sul tuo account.
      </p>
      {onDone && (
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
        >
          Continua
        </button>
      )}
    </div>
  )
}
