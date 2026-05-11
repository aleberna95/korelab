'use client'

import { useWizard } from '@/lib/onboarding/state'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-200 last:border-0">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-800 break-all">
        {value ?? <span className="text-gray-400 italic">non impostato</span>}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 pt-2">
        {title}
      </h3>
      <div className="bg-gray-50 rounded-lg px-4 py-1 divide-y divide-gray-200">{children}</div>
    </div>
  )
}

function Badge({
  text,
  color = 'gray',
}: {
  text: string
  color?: 'gray' | 'blue' | 'green' | 'amber'
}) {
  const cls = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-900/40 text-green-400',
    amber: 'bg-amber-900/40 text-amber-400',
  }[color]
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{text}</span>
}

export function StepReview() {
  const { state } = useWizard()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Riepilogo e conferma</h2>
        <p className="text-sm text-gray-500 mt-1">
          Controlla cosa verrà scritto nel database. L'operazione è irreversibile — puoi
          modificare i record in seguito dalle pagine di dettaglio.
        </p>
      </div>

      {/* Cliente */}
      <Section title="Cliente">
        {state.clientMode === 'existing' ? (
          <Row
            label="Modalità"
            value={
              <>
                <Badge text="esistente" /> {state.existingClientId}
              </>
            }
          />
        ) : (
          <>
            <Row label="Modalità" value={<Badge text="nuovo" color="green" />} />
            <Row label="Nome" value={state.client.name} />
            <Row label="Tipo azienda" value={state.client.businessType} />
            <Row
              label="Piano supporto"
              value={<Badge text={state.client.supportPlan} color="blue" />}
            />
            <Row
              label="Contatti"
              value={state.client.contacts.map((c) => `${c.name} <${c.email}>`).join(', ')}
            />
            <Row
              label="Consenso"
              value={
                [
                  state.client.consentMonitoring && 'monitoraggio',
                  state.client.consentNotification && 'notifiche',
                ]
                  .filter(Boolean)
                  .join(', ') || 'nessuno'
              }
            />
            {state.client.telegramChatId && (
              <Row label="Telegram chat ID" value={state.client.telegramChatId} />
            )}
            {state.client.tags && <Row label="Tags" value={state.client.tags} />}
          </>
        )}
      </Section>

      {/* Servizio */}
      <Section title="Servizio">
        <Row label="Nome" value={state.service.name} />
        <Row label="Tipo" value={state.service.type} />
        <Row label="Ambiente" value={state.service.environment} />
        <Row
          label="Criticità"
          value={
            <Badge
              text={state.service.criticality}
              color={state.service.criticality === 'critical' ? 'amber' : 'gray'}
            />
          }
        />
        {state.service.primaryUrl && (
          <Row label="URL principale" value={state.service.primaryUrl} />
        )}
        {state.service.healthcheckUrl && (
          <Row label="Healthcheck URL" value={state.service.healthcheckUrl} />
        )}
        <Row label="Pagina stato" value={state.service.statusPageVisibility} />
        {state.service.tags && <Row label="Tags" value={state.service.tags} />}
      </Section>

      {/* Monitor */}
      <Section title="Monitor">
        <Row label="Sorgente" value={state.monitor.source} />
        <Row label="Intervallo" value={`${state.monitor.intervalSec}s`} />
        <Row label="Stato atteso" value={String(state.monitor.expectStatus)} />
        {state.monitor.expectBody && (
          <Row label="Corpo atteso" value={state.monitor.expectBody} />
        )}
        <Row
          label="Canali allerta"
          value={
            [
              state.monitor.telegram && 'Telegram',
              state.monitor.clientNotify && 'Notifica cliente',
            ]
              .filter(Boolean)
              .join(', ') || 'nessuno'
          }
        />
      </Section>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        Cliccando <strong>Conferma e crea</strong> verranno scritti atomicamente tutti i
        documenti sopra in un'unica transazione Firestore. I fallimenti parziali annulleranno
        tutto.
      </div>
    </div>
  )
}
