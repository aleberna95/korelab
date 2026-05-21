/**
 * Offline fallback page — served by the service worker when the user
 * navigates to an uncached route while offline.
 * Must remain static (no server data fetching).
 */
'use client'
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <span className="text-6xl select-none" aria-hidden>
        📡
      </span>
      <h1 className="text-xl font-bold text-center">Sei offline</h1>
      <p className="text-sm text-[var(--color-fg-muted)] text-center max-w-xs">
        Nessuna connessione disponibile. Le pagine già visitate sono accessibili dalla cache.
        I dati scritti saranno sincronizzati appena torni online.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary px-5 py-2 text-sm mt-2"
      >
        Riprova
      </button>
    </div>
  )
}
