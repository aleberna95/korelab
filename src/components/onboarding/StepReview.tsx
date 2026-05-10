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
        <h2 className="text-xl font-bold text-white">Review & confirm</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Review what will be written to the database. This is irreversible — you can edit records afterwards from their detail pages.
        </p>
      </div>

      {/* Client */}
      <Section title="Client">
        {state.clientMode === 'existing' ? (
          <Row label="Mode" value={<><Badge text="existing" /> {state.existingClientId}</>} />
        ) : (
          <>
            <Row label="Mode" value={<Badge text="new" color="green" />} />
            <Row label="Name" value={state.client.name} />
            <Row label="Business type" value={state.client.businessType} />
            <Row label="Support plan" value={<Badge text={state.client.supportPlan} color="indigo" />} />
            <Row
              label="Contacts"
              value={state.client.contacts.map((c) => `${c.name} <${c.email}>`).join(', ')}
            />
            <Row label="Consent" value={[
              state.client.consentMonitoring && 'monitoring',
              state.client.consentNotification && 'notification',
              state.client.consentIntervention && 'intervention',
              state.client.consentAutoHealing && 'auto-healing',
            ].filter(Boolean).join(', ') || 'none'} />
            {state.client.tags && <Row label="Tags" value={state.client.tags} />}
          </>
        )}
      </Section>

      {/* Service */}
      <Section title="Service">
        <Row label="Name" value={state.service.name} />
        <Row label="Type" value={state.service.type} />
        <Row label="Environment" value={state.service.environment} />
        <Row label="Criticality" value={<Badge text={state.service.criticality} color={state.service.criticality === 'critical' ? 'amber' : 'zinc'} />} />
        {state.service.primaryUrl && <Row label="Primary URL" value={state.service.primaryUrl} />}
        {state.service.healthcheckUrl && <Row label="Healthcheck URL" value={state.service.healthcheckUrl} />}
        {state.service.tags && <Row label="Tags" value={state.service.tags} />}
        <Row label="Status page" value={state.visibility.statusPage} />
        <Row label="Report sharing" value={state.visibility.reportSharing} />
        <Row label="Automation" value={<><Badge text="disabled" color="zinc" /> (forced in MVP)</>} />
      </Section>

      {/* Monitor */}
      {showMonitoring && (
        <Section title="Monitor">
          <Row label="Source" value={state.monitor.source} />
          <Row label="Interval" value={`${state.monitor.intervalSec}s`} />
          <Row label="Expect status" value={String(state.monitor.expectStatus)} />
          {state.monitor.expectBody && <Row label="Expect body" value={state.monitor.expectBody} />}
          <Row label="Alert channels" value={[
            state.monitor.telegram && 'Telegram',
            state.monitor.email && 'Email',
            state.monitor.clientNotify && 'Client notify',
          ].filter(Boolean).join(', ') || 'none'} />
        </Section>
      )}

      {/* Access */}
      {showAccess && (
        <Section title="Access">
          <Row label="Level" value={state.access.level} />
          {state.access.providers && <Row label="Providers" value={state.access.providers} />}
          {state.access.secretManagerRefs.trim() && (
            <Row
              label="Secret refs"
              value={
                <span className="font-mono text-xs">
                  {state.access.secretManagerRefs.split('\n').filter(Boolean).length} reference(s)
                </span>
              }
            />
          )}
        </Section>
      )}

      {/* Resources */}
      {state.resources.length > 0 && (
        <Section title="Resources">
          {state.resources.map((r, i) => (
            <Row key={i} label={r.kind} value={r.name} />
          ))}
        </Section>
      )}

      {/* Runbook */}
      <Section title="Runbook">
        {state.runbookMode === 'none' && <Row label="Mode" value="Skip — no runbook" />}
        {state.runbookMode === 'existing' && (
          <>
            <Row label="Mode" value={<Badge text="existing" />} />
            <Row label="ID" value={state.existingRunbookId} />
          </>
        )}
        {state.runbookMode === 'new' && (
          <>
            <Row label="Mode" value={<Badge text="new" color="green" />} />
            <Row label="Title" value={state.runbook.title} />
            <Row label="Recovery steps" value={String(state.runbook.recoverySteps.length)} />
            <Row label="Common failures" value={String(state.runbook.commonFailures.length)} />
          </>
        )}
      </Section>

      <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-lg px-4 py-3 text-sm text-indigo-300">
        Clicking <strong>Confirm & Create</strong> will atomically write all the above documents in a single Firestore transaction. Partial failures will roll back everything.
      </div>
    </div>
  )
}
