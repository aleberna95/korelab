'use client'

import { useState } from 'react'
import { getAuth, sendPasswordResetEmail } from 'firebase/auth'
import { clientApp } from '@/lib/firebase/client'

export function ResetPasswordButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleReset() {
    const email = getAuth(clientApp).currentUser?.email
    if (!email) {
      setMessage({ type: 'error', text: 'Nessun account rilevato. Effettua nuovamente il login.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      await sendPasswordResetEmail(getAuth(clientApp), email)
      setMessage({ type: 'ok', text: `Email di recupero inviata a ${email}.` })
    } catch {
      setMessage({ type: 'error', text: 'Impossibile inviare l\'email. Riprova più tardi.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Reimposta password</p>
        <p className="text-xs text-gray-400">Riceverai un link via email per impostare una nuova password.</p>
        {message && (
          <p className={`text-xs mt-1 ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleReset}
        disabled={loading}
        className="shrink-0 text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        {loading ? 'Invio…' : 'Invia link'}
      </button>
    </div>
  )
}
