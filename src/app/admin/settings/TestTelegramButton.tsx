'use client'

import { useState } from 'react'

export function TestTelegramButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleTest() {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/settings/test-telegram', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setState('ok')
        setTimeout(() => setState('idle'), 4000)
      } else {
        setErrorMsg(data.error ?? 'Errore sconosciuto')
        setState('error')
      }
    } catch {
      setErrorMsg('Richiesta fallita')
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleTest}
        disabled={state === 'loading'}
        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? 'Invio...' : 'Invia messaggio test'}
      </button>
      {state === 'ok' && (
        <span className="text-xs text-green-600 font-medium">✅ Messaggio inviato!</span>
      )}
      {state === 'error' && (
        <span className="text-xs text-red-600">{errorMsg}</span>
      )}
    </div>
  )
}
