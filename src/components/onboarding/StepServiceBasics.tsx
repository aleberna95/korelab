'use client'

import { useWizard } from '@/lib/onboarding/state'

const INPUT =
  'input-base'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

const SERVICE_TYPES = [
  'static-site', 'landing', 'corporate-site', 'ecommerce', 'saas',
  'api', 'mobile-backend', 'firebase-project', 'domain', 'other',
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
        <p className="text-sm text-gray-500 mt-1">Definisci cos'è questo servizio e dove si trova.</p>
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

      <div className="grid grid-cols-2 gap-3">
          <Field label="URL principale">
            <input
              value={s.primaryUrl}
              onChange={(e) => patch({ primaryUrl: e.target.value })}
              placeholder="https://acme.com"
              className={INPUT}
              type="url"
            />
          </Field>
          <Field label="Healthcheck URL" hint="Usato per controlli HTTP/SSL">
            <input
              value={s.healthcheckUrl}
              onChange={(e) => patch({ healthcheckUrl: e.target.value })}
              placeholder="https://acme.com/health"
              className={INPUT}
              type="url"
            />
          </Field>
        </div>

      <Field label="Visibilità pagina stato">
        <select
          value={s.statusPageVisibility}
          onChange={(e) => patch({ statusPageVisibility: e.target.value })}
          className={INPUT}
        >
          <option value="private">Privata (solo admin)</option>
          <option value="tokenized">Link segreto (tokenizzata)</option>
          <option value="public">Pubblica</option>
        </select>
      </Field>
    </div>
  )
}
