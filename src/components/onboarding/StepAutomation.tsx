'use client'

export function StepAutomation() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Automation</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Auto-healing configuration — visible because the selected plan and consent allow it.
        </p>
      </div>

      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-sm text-amber-300">
        <strong>MVP notice:</strong> Automation mode is always set to{' '}
        <code className="font-mono text-amber-200">disabled</code> in this release regardless of
        selection. This step is captured for planning purposes only. Auto-healing will be enabled
        in a future phase once runbook coverage is verified.
      </div>

      <div className="space-y-3 opacity-50 pointer-events-none select-none">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Automation mode
        </label>
        {(
          [
            ['disabled', 'Disabled — no automation'],
            ['manual-only', 'Manual only — log actions, require human approval'],
            ['manual-approval', 'Manual approval — suggest actions, require click'],
            ['auto-low-risk', 'Auto low-risk — execute safe actions automatically'],
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
