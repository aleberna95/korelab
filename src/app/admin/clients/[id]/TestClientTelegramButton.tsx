'use client'

import { useState } from 'react'

export function TestClientTelegramButton({ clientId, hasChatId }: { clientId: string; hasChatId: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!hasChatId) return null

  async function handleTest() {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/clients/${clientId}/test-telegram`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setState('ok')
        setTimeout(() => setState('idle'), 5000)
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
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleTest}
        disabled={state === 'loading'}
        className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? '...' : 'Testa notifica'}
      </button>
      {state === 'ok' && <span className="text-xs text-green-600">✅ Inviato!</span>}
      {state === 'error' && <span className="text-xs text-red-500">{errorMsg}</span>}
    </span>
  )
}
