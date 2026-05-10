'use client'

import { useWizard, getEffectiveSupportPlan, getActiveSteps } from '@/lib/onboarding/state'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="text-zinc-200 break-all">{value ?? <span className="text-zinc-600 italic">not set</span>}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 pt-2">{title}</h3>
      <div className="bg-zinc-900 rounded-lg px-4 py-1 divide-y divide-zinc-800">
        {children}
      </div>
    </div>
  )
}

function Badge({ text, color = 'zinc' }: { text: string; color?: 'zinc' | 'indigo' | 'green' | 'amber' }) {
  const cls = {
    zinc: 'bg-zinc-700 text-zinc-300',
    indigo: 'bg-indigo-900/50 text-indigo-300',
    green: 'bg-green-900/40 text-green-400',
    amber: 'bg-amber-900/40 text-amber-400',
  }[color]
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{text}</span>
  )
}

export function StepReview() {
  const { state } = useWizard()
  const activeSteps = getActiveSteps(state)
  const plan = getEffectiveSupportPlan(state)

  const showMonitoring = activeSteps.includes('monitoring')
  const showAccess = activeSteps.includes('access')
  const showAutomation = activeSteps.includes('automation')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Riepilogo e conferma</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Controlla cosa verrà scritto nel database. L'operazione è irreversibile — puoi modificare i record in seguito dalle pagine di dettaglio.
        </p>
      </div>

      {/* Client */}
      <Section title="Cliente">
        {state.clientMode === 'existing' ? (
          <Row label="Modalità" value={<><Badge text="esistente" /> {state.existingClientId}</>} />
        ) : (
          <>
            <Row label="Modalità" value={<Badge text="nuovo" color="green" />} />
            <Row label="Nome" value={state.client.name} />
            <Row label="Tipo azienda" value={state.client.businessType} />
            <Row label="Piano supporto" value={<Badge text={state.client.supportPlan} color="indigo" />} />
            <Row
              label="Contatti"
              value={state.client.contacts.map((c) => `${c.name} <${c.email}>`).join(', ')}
            />
            <Row label="Consenso" value={[
              state.client.consentMonitoring && 'monitoraggio',
              state.client.consentNotification && 'notifiche',
              state.client.consentIntervention && 'intervento',
              state.client.consentAutoHealing && 'auto-healing',
            ].filter(Boolean).join(', ') || 'nessuno'} />
            {state.client.tags && <Row label="Tags" value={state.client.tags} />}
          </>
        )}
      </Section>

      {/* Service */}
      <Section title="Servizio">
        <Row label="Nome" value={state.service.name} />
        <Row label="Tipo" value={state.service.type} />
        <Row label="Ambiente" value={state.service.environment} />
        <Row label="Criticità" value={<Badge text={state.service.criticality} color={state.service.criticality === 'critical' ? 'amber' : 'zinc'} />} />
        {state.service.primaryUrl && <Row label="Primary URL" value={state.service.primaryUrl} />}
        {state.service.healthcheckUrl && <Row label="Healthcheck URL" value={state.service.healthcheckUrl} />}
        {state.service.tags && <Row label="Tags" value={state.service.tags} />}
        <Row label="Pagina stato" value={state.visibility.statusPage} />
        <Row label="Condivisione report" value={state.visibility.reportSharing} />
        <Row label="Automazione" value={<><Badge text="disabilitata" color="zinc" /> (forzata in MVP)</>} />
      </Section>

      {/* Monitor */}
      {showMonitoring && (
        <Section title="Monitor">
          <Row label="Sorgente" value={state.monitor.source} />
          <Row label="Intervallo" value={`${state.monitor.intervalSec}s`} />
          <Row label="Stato atteso" value={String(state.monitor.expectStatus)} />
          {state.monitor.expectBody && <Row label="Corpo atteso" value={state.monitor.expectBody} />}
          <Row label="Canali allerta" value={[
            state.monitor.telegram && 'Telegram',
            state.monitor.email && 'Email',
            state.monitor.clientNotify && 'Notifica cliente',
          ].filter(Boolean).join(', ') || 'nessuno'} />
        </Section>
      )}

      {/* Access */}
      {showAccess && (
        <Section title="Access">
          <Row label="Livello" value={state.access.level} />
          {state.access.providers && <Row label="Providers" value={state.access.providers} />}
          {state.access.secretManagerRefs.trim() && (
            <Row
              label="Riferimenti secret"
              value={
                <span className="font-mono text-xs">
                  {state.access.secretManagerRefs.split('\n').filter(Boolean).length} riferimento/i
                </span>
              }
            />
          )}
        </Section>
      )}

      {/* Resources */}
      {state.resources.length > 0 && (
        <Section title="Risorse">
          {state.resources.map((r, i) => (
            <Row key={i} label={r.kind} value={r.name} />
          ))}
        </Section>
      )}

      {/* Runbook */}
      <Section title="Runbook">
        {state.runbookMode === 'none' && <Row label="Modalità" value="Salta — nessun runbook" />}
        {state.runbookMode === 'existing' && (
          <>
            <Row label="Modalità" value={<Badge text="esistente" />} />
            <Row label="ID" value={state.existingRunbookId} />
          </>
        )}
        {state.runbookMode === 'new' && (
          <>
            <Row label="Modalità" value={<Badge text="nuovo" color="green" />} />
            <Row label="Titolo" value={state.runbook.title} />
            <Row label="Passi di ripristino" value={String(state.runbook.recoverySteps.length)} />
            <Row label="Problemi comuni" value={String(state.runbook.commonFailures.length)} />
          </>
        )}
      </Section>

      <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-lg px-4 py-3 text-sm text-indigo-300">
        Cliccando <strong>Conferma e crea</strong> verranno scritti atomicamente tutti i documenti sopra in un'unica transazione Firestore. I fallimenti parziali annulleranno tutto.
      </div>
    </div>
  )
}
