'use client'

export function StepAutomation() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Automazione</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Configurazione auto-healing — visibile perché il piano e il consenso selezionati lo permettono.
        </p>
      </div>

      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-sm text-amber-300">
        <strong>Avviso MVP:</strong> La modalità di automazione è sempre impostata su{' '}
        <code className="font-mono text-amber-200">disabled</code> in questa versione,
        indipendentemente dalla selezione. Questo passo è registrato solo a scopo di pianificazione.
        L'auto-healing verrà abilitato in una fase futura una volta verificata la copertura del runbook.
      </div>

      <div className="space-y-3 opacity-50 pointer-events-none select-none">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Modalità automazione
        </label>
        {(
          [
            ['disabled', 'Disabilitato — nessuna automazione'],
            ['manual-only', 'Solo manuale — registra azioni, richiede approvazione umana'],
            ['manual-approval', 'Approvazione manuale — suggerisce azioni, richiede click'],
            ['auto-low-risk', 'Auto basso rischio — esegue azioni sicure automaticamente'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="radio"
              name="automationMode"
              value={value}
              readOnly
              checked={value === 'disabled'}
              className="accent-indigo-500"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
