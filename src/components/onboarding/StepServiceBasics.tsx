'use client'

import { useWizard } from '@/lib/onboarding/state'

const INPUT =
  'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

const SERVICE_TYPES = [
  'static-site', 'landing', 'corporate-site', 'ecommerce', 'saas',
  'api', 'mobile-backend', 'database', 'docker-service', 'k8s-deployment',
  'cron', 'worker', 'firebase-project', 'external-saas', 'domain', 'email', 'other',
]

const ENVIRONMENTS = ['production', 'staging', 'dev']
const CRITICALITIES = ['low', 'medium', 'high', 'critical']

export function StepServiceBasics() {
  const { state, dispatch } = useWizard()
  const s = state.service

  function patch(p: Partial<typeof s>) {
    dispatch({ type: 'UPDATE_SERVICE', patch: p })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dati servizio</h2>
        <p className="text-sm text-zinc-400 mt-1">Definisci cos'è questo servizio e dove si trova.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome servizio *">
          <input
            value={s.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Main Website"
            className={INPUT}
          />
        </Field>

        <Field label="Tipo *">
          <select
            value={s.type}
            onChange={(e) => patch({ type: e.target.value })}
            className={INPUT}
          >
            <option value="">— select —</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Ambiente *">
          <select
            value={s.environment}
            onChange={(e) => patch({ environment: e.target.value })}
            className={INPUT}
          >
            {ENVIRONMENTS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </Field>

        <Field label="Criticità *">
          <select
            value={s.criticality}
            onChange={(e) => patch({ criticality: e.target.value })}
            className={INPUT}
          >
            {CRITICALITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descrizione">
        <textarea
          value={s.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          placeholder="Breve descrizione di cosa fa questo servizio…"
          className={INPUT}
        />
      </Field>

      <Field label="Tag (separati da virgola)">
        <input
          value={s.tags}
          onChange={(e) => patch({ tags: e.target.value })}
          placeholder="wordpress, nginx, mysql"
          className={INPUT}
        />
      </Field>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          URLs
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary URL">
            <input
              value={s.primaryUrl}
              onChange={(e) => patch({ primaryUrl: e.target.value })}
              placeholder="https://acme.com"
              className={INPUT}
              type="url"
            />
          </Field>
          <Field label="Admin URL">
            <input
              value={s.adminUrl}
              onChange={(e) => patch({ adminUrl: e.target.value })}
              placeholder="https://acme.com/wp-admin"
              className={INPUT}
              type="url"
            />
          </Field>
          <Field label="Healthcheck URL" hint="Usato per controlli HTTP interni">
            <input
              value={s.healthcheckUrl}
              onChange={(e) => patch({ healthcheckUrl: e.target.value })}
              placeholder="https://acme.com/health"
              className={INPUT}
              type="url"
            />
          </Field>
          <Field label="Docs URL">
            <input
              value={s.docsUrl}
              onChange={(e) => patch({ docsUrl: e.target.value })}
              placeholder="https://notion.so/..."
              className={INPUT}
              type="url"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}
