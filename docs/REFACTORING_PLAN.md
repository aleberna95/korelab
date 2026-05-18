# KoreLab — Piano di Refactoring: Semplificazione MVP

> **Obiettivo:** Snellire il progetto mantenendo solo le funzionalità core: **monitoring HTTP/SSL**, **alerting Telegram**, **gestione progetti Firebase**. Rimuovere tutto ciò che riguarda k8s, Docker, UptimeRobot, email (Resend), DNS check, domain WHOIS, e semplificare il wizard e la UI per ottenere un CRM leggero ma completo per le esigenze attuali.
>
> **Approccio:** Ogni sezione è autocontenuta e va eseguita nell'ordine indicato. Ogni modifica include i file esatti da toccare e le trasformazioni da applicare.

---

## Indice

1. [Rimozione monitor source: UptimeRobot](#1-rimozione-uptimerobot)
2. [Rimozione monitor source: DNS e Domain (WHOIS)](#2-rimozione-dns-e-domain-whois)
3. [Rimozione canale alert: Email (Resend)](#3-rimozione-email-resend)
4. [Semplificazione tipi ServiceType e ResourceKind](#4-semplificazione-tipi-servicetype-e-resourcekind)
5. [Semplificazione Client: rimozione supportPlan complessi e consent granulare](#5-semplificazione-client)
6. [Semplificazione Service: rimozione automation, access, secret refs](#6-semplificazione-service)
7. [Snellimento wizard onboarding (da 9 a 4 step)](#7-snellimento-wizard-onboarding)
8. [Rimozione sezioni admin non necessarie](#8-rimozione-sezioni-admin)
9. [Semplificazione Cloud Functions](#9-semplificazione-cloud-functions)
10. [Pulizia Firestore (rules, indexes, collections)](#10-pulizia-firestore)
11. [Pulizia webhook route e API](#11-pulizia-webhook-route)
12. [Semplificazione Settings e Health Check](#12-semplificazione-settings-e-health-check)
13. [Pulizia generale: file orfani, test, docs](#13-pulizia-generale)
14. [Riepilogo struttura finale](#14-riepilogo-struttura-finale)

---

## 1. Rimozione UptimeRobot

UptimeRobot è un'integrazione esterna che aggiunge complessità (sync bidirezionale, webhook secrets, webhook route, client API). Il sistema ha già check interni HTTP/SSL che coprono le stesse esigenze.

### File da eliminare

```
functions/src/uptimerobot/client.ts
functions/src/uptimerobot/syncMonitor.ts
functions/src/uptimerobot/types.ts
functions/lib/uptimerobot/          (tutta la cartella compilata)
src/app/api/webhooks/               (tutta la cartella — solo UptimeRobot usa webhooks)
src/lib/webhooks/                   (tutta la cartella)
tests/webhooks/                     (tutta la cartella)
```

### File da modificare

#### `functions/src/index.ts`
- Rimuovere: `export { syncUptimeRobotMonitor } from './uptimerobot/syncMonitor'`

#### `functions/src/lib/types.ts`
- `MonitorSource`: rimuovere `'uptimerobot'` → resta `'internal-http' | 'internal-ssl'`
- Rimuovere campo `externalId?: string` da `Monitor`

#### `functions/src/checks/internalChecks.ts`
- `INTERNAL_SOURCES`: rimuovere `'internal-dns'` e `'internal-domain'` → resta `['internal-http', 'internal-ssl']`
- Switch in `processMonitor`: rimuovere case `'internal-dns'` e `'internal-domain'`

#### `functions/src/weeklyHealthCheck.ts`
- Rimuovere il check di UptimeRobot API connectivity

#### `src/lib/domain/types.ts`
- `MonitorSource`: stesse modifiche del types delle functions (sync)
- Rimuovere `externalId` da `Monitor`
- `Incident.source`: rimuovere `'uptimerobot'` → resta `'internal-check' | 'manual'`

#### `src/lib/onboarding/state.ts` e `validators.ts`
- `monitor.source`: default diventa `'internal-http'`, opzioni solo `'internal-http' | 'internal-ssl'`

#### `src/components/onboarding/StepMonitoring.tsx`
- Rimuovere opzione "UptimeRobot" dal dropdown source
- Rimuovere opzioni "internal-dns" e "internal-domain"

#### `src/app/admin/settings/page.tsx`
- Rimuovere indicatore salute "UptimeRobot"

#### Firestore collections da non usare più
- `webhookEvents` — non serve più
- `webhookSecrets` — non serve più
- `processedEvents` — non serve più (era per idempotenza webhook)

#### Firestore rules (`firestore.rules`)
- Rimuovere le regole per `webhookEvents`, `webhookSecrets`, `processedEvents`

#### Firestore indexes (`firestore.indexes.json`)
- Rimuovere gli index relativi a queste collection

---

## 2. Rimozione DNS e Domain (WHOIS)

I check DNS (drift detection) e Domain (WHOIS expiry) richiedono servizi esterni a pagamento (whoisjsonapi.com) e sono per un use case futuro (gestione domini). Per ora il monitoring si limita a HTTP e SSL.

### File da eliminare

```
functions/src/checks/dns.ts
functions/src/checks/domain.ts
functions/lib/checks/dns.js
functions/lib/checks/domain.js
```

### File da modificare

#### `functions/src/checks/internalChecks.ts`
- Rimuovere import di `checkDNS` e `checkDomain`
- Rimuovere i case `'internal-dns'` e `'internal-domain'` dal switch
- `INTERNAL_SOURCES = ['internal-http', 'internal-ssl']`

#### `functions/src/checks/alertLadder.ts`
- Rimuovere `DOMAIN_THRESHOLDS` (resta solo `SSL_THRESHOLDS`)

#### `src/lib/domain/types.ts`
- `MonitorSource`: solo `'internal-http' | 'internal-ssl'`
- Rimuovere `expectRecords` dal config del Monitor (era per DNS)

#### Secret Manager
- Non serve più creare il secret `whois-api-key`

---

## 3. Rimozione Email (Resend)

Per ora le notifiche passano solo via Telegram. Rimuovere Resend semplifica secrets, dipendenze, e canali alert.

### File da eliminare

```
functions/src/alerts/email.ts
functions/lib/alerts/email.js
```

### File da modificare

#### `functions/src/checks/internalChecks.ts` (o ovunque `sendEmail` sia usato)
- Rimuovere qualsiasi import/chiamata a `sendEmail`

#### `functions/src/incidents/onIncidentWrite.ts`
- Rimuovere la logica di invio email (mantenere solo Telegram)

#### `functions/src/weeklyHealthCheck.ts`
- Rimuovere il check di Resend API connectivity

#### `src/lib/domain/types.ts` → `Monitor.alertChannels`
- Rimuovere `email: boolean` → resta solo `{ telegram: boolean; clientNotify: boolean }`
- Oppure semplificare tutto a `alertTelegram: boolean` solo

#### `src/lib/domain/types.ts` → `Client.notificationPrefs`
- Rimuovere `email: boolean` e `emails: string[]`
- Resta solo `{ telegramChatId?: string; quietHours?: ... }`

#### `src/lib/onboarding/state.ts`
- `monitor`: rimuovere `email: boolean`
- `client`: rimuovere `notificationEmail` e `notificationEmails`

#### `src/components/onboarding/StepMonitoring.tsx`
- Rimuovere checkbox "Email"

#### `src/components/onboarding/StepClient.tsx`
- Rimuovere campi notifica email

#### `src/app/admin/settings/page.tsx`
- Rimuovere indicatore salute "Resend"

#### Secret Manager
- Non serve più creare il secret `resend-api-key`
- Rimuovere env var `ALERT_FROM_EMAIL`

---

## 4. Semplificazione tipi ServiceType e ResourceKind

### `ServiceType` — da 17 a 8 valori

Rimuovere i tipi k8s/Docker/infra e tenere quelli rilevanti per progetti web/Firebase:

```typescript
// PRIMA (17 tipi)
export type ServiceType =
  | 'static-site' | 'landing' | 'corporate-site' | 'ecommerce'
  | 'saas' | 'api' | 'mobile-backend' | 'database'
  | 'docker-service' | 'k8s-deployment'  // ← RIMUOVERE
  | 'cron' | 'worker'
  | 'firebase-project' | 'external-saas' | 'domain' | 'email' | 'other'

// DOPO (10 tipi — compatto ma completo)
export type ServiceType =
  | 'static-site'
  | 'landing'
  | 'corporate-site'
  | 'ecommerce'
  | 'saas'
  | 'api'
  | 'mobile-backend'
  | 'firebase-project'
  | 'domain'
  | 'other'
```

**Razionale:** `database`, `cron`, `worker`, `email`, `external-saas` non sono servizi monitorabili direttamente via HTTP/SSL nel contesto attuale. Se servono in futuro si riaggiungeranno.

### `ResourceKind` — da 10 a 5 valori

```typescript
// PRIMA
export type ResourceKind =
  | 'docker-host' | 'k8s-cluster'  // ← RIMUOVERE
  | 'db' | 'dns-zone'              // ← RIMUOVERE (dns-zone)
  | 'ssl-cert' | 'domain' | 'repo'
  | 'firebase-project' | 'vps'     // ← RIMUOVERE (vps — non abbiamo infra)
  | 'other'

// DOPO
export type ResourceKind =
  | 'db'
  | 'ssl-cert'
  | 'domain'
  | 'repo'
  | 'firebase-project'
  | 'other'
```

### File da modificare

- `src/lib/domain/types.ts` — aggiornare entrambi i type union
- `functions/src/lib/types.ts` — stesse modifiche (se esiste una copia)
- `src/components/onboarding/StepService.tsx` — aggiornare il dropdown dei tipi
- `src/components/onboarding/StepResources.tsx` — aggiornare il dropdown dei kind (se lo step resta)
- `src/app/admin/runbooks/` — se ci sono filtri per serviceType, aggiornare le opzioni
- `src/components/dashboard/FilterBar.tsx` — se lista i tipi, aggiornare

---

## 5. Semplificazione Client

Il modello Client ha campi pensati per un CRM enterprise con 6 livelli di support plan, consent granulare, e contratti. Per un MVP leggero:

### Modifiche al modello `Client`

```typescript
// PRIMA
export type SupportPlan =
  | 'none' | 'monitor-only' | 'reporting-only'
  | 'managed-support' | 'managed-infra' | 'auto-healing'

// DOPO — 3 livelli chiari
export type SupportPlan = 'monitor-only' | 'managed' | 'full'
```

#### Campi da rimuovere/semplificare su `Client`

| Campo | Azione |
|-------|--------|
| `consent.intervention` | Rimuovere (non interveniamo attivamente ora) |
| `consent.autoHealing` | Rimuovere (Phase 11 deferita) |
| `consent.consentedAt` | Rimuovere |
| `contractRef` (tutto) | Rimuovere (no gestione contratti nell'MVP) |
| `notificationPrefs.email` | Rimuovere (solo Telegram) |
| `notificationPrefs.emails` | Rimuovere |
| `notificationPrefs.quietHours` | Opzionale — tenere se semplice, altrimenti rimuovere |

#### Modello Client semplificato

```typescript
export interface Client {
  id: string
  name: string
  businessType: 'agency' | 'ecommerce' | 'corporate' | 'startup' | 'other'
  contacts: Contact[]
  telegramChatId?: string
  supportPlan: SupportPlan  // 'monitor-only' | 'managed' | 'full'
  consent: {
    monitoring: boolean
    notification: boolean
  }
  tags: string[]
  notes: string
  status: 'active' | 'paused' | 'archived'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### File da modificare

- `src/lib/domain/types.ts`
- `functions/src/lib/types.ts`
- `src/lib/onboarding/state.ts` — semplificare `WizardState.client`
- `src/lib/onboarding/validators.ts` — semplificare validazione step client
- `src/components/onboarding/StepClient.tsx` — rimuovere campi UI (consent granulare, contract, email prefs)
- `src/app/admin/clients/page.tsx` — aggiornare badge supportPlan
- `src/app/admin/clients/[id]/page.tsx` — semplificare detail view
- `src/app/api/onboarding/submit/route.ts` — semplificare schema Zod e logica condizionale per supportPlan

---

## 6. Semplificazione Service

### Campi da rimuovere su `Service`

| Campo | Motivo rimozione |
|-------|-----------------|
| `automation` (tutto l'oggetto) | Phase 11 deferita, sempre `'disabled'` |
| `access` (tutto l'oggetto) | Complicato per MVP — accessi li gestisci tu direttamente |
| `visibility.reportSharing` | Rimuovere sharing via email (no Resend) → teniamo solo `statusPage` |
| `resourceIds` | Le risorse le semplifichiamo molto (vedi sotto) |
| `runbookIds` | I runbook li rimuoviamo dall'MVP (vedi sezione 8) |
| `urls.admin` | Non fondamentale per MVP |
| `urls.docs` | Non fondamentale per MVP |
| `expectedHealth.bodyContains` | Troppo specifico — bastano gli status code |

#### Modello Service semplificato

```typescript
export interface Service {
  id: string
  clientId: string
  name: string
  type: ServiceType
  environment: 'production' | 'staging' | 'dev'
  criticality: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  description: string
  url?: string                     // era urls.primary
  healthcheckUrl?: string          // era urls.healthcheck
  statusPageVisibility: 'private' | 'tokenized' | 'public'
  currentStatus: {
    state: ServiceStatusState
    since: Timestamp
    activeIncidentId?: string
    lastCheckAt?: Timestamp
    uptime30d?: number
  }
  monitorIds: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### File da modificare

- `src/lib/domain/types.ts`
- `functions/src/lib/types.ts`
- `src/lib/onboarding/state.ts` — rimuovere i campi wizard corrispondenti
- `src/lib/onboarding/validators.ts` — semplificare
- `src/components/onboarding/StepService.tsx` — rimuovere campi admin/docs URL, description semplificata
- `src/app/admin/services/[id]/page.tsx` — rimuovere sezioni access, resources, runbooks, automation
- `src/components/dashboard/DependencyGraph.tsx` — RIMUOVERE (il grafo dipendenze non serve senza risorse complesse)
- `src/components/dashboard/FilterBar.tsx` — semplificare filtri (rimuovere `no-access`)

---

## 7. Snellimento Wizard Onboarding (da 9 a 4 step)

Il wizard attuale ha 9 step. Molti non servono nell'MVP. Il nuovo wizard ha **4 step**:

| Step | Nome | Contenuto |
|------|------|-----------|
| 1 | **Cliente** | Nome, tipo business, contatto principale (nome, email, telefono), Telegram chat ID, piano supporto (3 opzioni), consent monitoring/notifica, note |
| 2 | **Servizio** | Nome, tipo (10 opzioni), environment, criticality, URL principale, URL healthcheck, tags, descrizione breve, visibilità status page |
| 3 | **Monitor** | Tipo (HTTP o SSL), intervallo, URL da monitorare (pre-filled da step 2), expected status code (solo per HTTP), alert Telegram on/off |
| 4 | **Riepilogo** | Review + conferma → submit |

### Step RIMOSSI

| Step rimosso | Motivo |
|--------------|--------|
| Access (step 4) | Non serve nell'MVP — gestisci accessi fuori dal tool |
| Resources (step 5) | Non serve — niente k8s/Docker/infra da mappare |
| Visibility (step 6) | Accorpato allo step Servizio (un solo campo: statusPageVisibility) |
| Automation (step 7) | Sempre disabled — rimosso |
| Runbook (step 8) | Rimosso dall'MVP (vedi sezione 8) |

### File da modificare

#### `src/lib/onboarding/state.ts`

```typescript
export type StepId = 'client' | 'service' | 'monitoring' | 'review'

export const STEP_LABELS: Record<StepId, string> = {
  client: 'Cliente',
  service: 'Servizio',
  monitoring: 'Monitor',
  review: 'Riepilogo',
}
```

- Rimuovere tutto lo state per: `access`, `resources`, `visibility`, `automation`, `runbookMode`, `existingRunbookId`, `runbook`
- Rimuovere le action corrispondenti: `UPDATE_ACCESS`, `ADD_RESOURCE`, `REMOVE_RESOURCE`, `UPDATE_VISIBILITY`, `UPDATE_AUTOMATION`, `SET_RUNBOOK_MODE`, `SET_EXISTING_RUNBOOK`, `UPDATE_RUNBOOK`, `ADD_COMMON_FAILURE`, `REMOVE_COMMON_FAILURE`, `ADD_RECOVERY_STEP`, `REMOVE_RECOVERY_STEP`
- Aggiungere `statusPageVisibility` nello state del service

#### `src/lib/onboarding/validators.ts`
- Rimuovere validatori per step 4-8
- Aggiornare `buildSubmitPayload()` — payload molto più semplice
- Rimuovere logica condizionale per supportPlan che skip steps

#### `src/components/onboarding/`

File da eliminare:
```
StepAccess.tsx
StepResources.tsx
StepVisibility.tsx
StepAutomation.tsx
StepRunbook.tsx
```

File da aggiornare:
- `WizardShell.tsx` — aggiornare la lista step (da 9 a 4), rimuovere logica skip
- `StepClient.tsx` — semplificare (3 piani, no contract, no email prefs)
- `StepService.tsx` — semplificare (meno tipi, aggiungere statusPageVisibility)
- `StepMonitoring.tsx` — semplificare (solo HTTP/SSL, solo Telegram)
- `StepReview.tsx` — aggiornare per mostrare solo i 3 step

#### `src/app/api/onboarding/submit/route.ts`
- Semplificare schema Zod (meno campi)
- Rimuovere creazione resource/runbook/dependency
- Il submit crea solo: Client (o link), Service, Monitor

---

## 8. Rimozione sezioni admin non necessarie

### Pagine admin da RIMUOVERE

| Sezione | Motivo |
|---------|--------|
| `/admin/runbooks` | Troppo complesso per MVP — reintrodurre quando serve |
| ~~`/admin/tasks`~~ | **TENERE** — lavagna todo/doing/done per progetto, utile per tracciare attività |
| `/admin/tokens` | Complesso — la status page pubblica basta per ora |
| `/admin/maintenance` | Non implementato (create commentato), rimuovere |
| `/admin/reports` | Rimuovere per ora — i daily rollup interni restano per storico, ma la UI report la aggiungiamo dopo |

### Pagine admin che RESTANO

| Sezione | Note |
|---------|------|
| `/admin` (dashboard) | Semplificato: KPI, incident attivi, servizi senza monitor |
| `/admin/clients` | Lista e dettaglio clienti |
| `/admin/services` | Lista e dettaglio servizi (filtri semplificati) |
| `/admin/monitors` | Lista monitor con ultimo check |
| `/admin/incidents` | Lista e dettaglio incidenti |
| `/admin/onboarding` | Wizard semplificato (4 step) |
| `/admin/tasks` | Lavagna todo/doing/done per progetto |
| `/admin/settings` | Solo: profilo admin + check Telegram |
| `/admin/audit` | Log attività (sola lettura, utile) |

### File/cartelle da eliminare

```
src/app/admin/runbooks/       (tutta la cartella)
src/app/admin/tokens/         (tutta la cartella)
src/app/admin/maintenance/    (tutta la cartella)
src/app/admin/reports/        (tutta la cartella)
src/components/incidents/IncidentDetail.tsx  — valutare se semplificare o tenere
```

### File da modificare

#### `src/app/admin/layout.tsx`
- Rimuovere voci sidebar: Runbooks, Tokens, Maintenance, Reports

#### `src/app/admin/page.tsx` (dashboard)
- Rimuovere "Services Without Monitor" se troppo verboso
- Mantenere KPI + Active Incidents + Recent Audit

#### `src/components/dashboard/DependencyGraph.tsx`
- **ELIMINARE** — il grafo dipendenze non serve senza risorse e dependencies

#### `src/components/dashboard/FilterBar.tsx`
- Rimuovere filtro `no-access` e `active-incident` (ridondante)

### Firestore collections non più usate (lato UI)

- `runbooks` — non più gestito da UI (i dati restano se esistono)
- ~~`tasks`~~ — **TENERE** (lavagna kanban per progetto)
- `statusTokens` — non più gestito da UI
- `maintenanceWindows` — non più gestito da UI
- `reports` — generati automaticamente ma non esposti in UI
- `resources` — non più gestito da UI
- `dependencies` — non più gestito da UI
- `secretRefs` — non più gestito da UI

---

## 9. Semplificazione Cloud Functions

### Funzioni da MANTENERE

| Funzione | Tipo | Note |
|----------|------|------|
| `internalChecks` | Scheduled (15 min) | Solo HTTP + SSL |
| `onIncidentWrite` | Firestore trigger | Solo alert Telegram (no email) |
| `resolveStableUp` | Scheduled (1 min) | Invariato |
| `weeklyHealthCheck` | Scheduled (lunedì 08:00) | Solo check Telegram + Firestore (no UptimeRobot, no Resend) |

### Funzioni da RIMUOVERE

| Funzione | Motivo |
|----------|--------|
| `syncUptimeRobotMonitor` | UptimeRobot rimosso |
| `dailyRollup` | Report rimossi dall'MVP |
| `generateMonthlyReports` | Report rimossi dall'MVP |

### File da eliminare

```
functions/src/uptimerobot/          (tutta la cartella)
functions/src/reporting/            (tutta la cartella)
functions/src/alerts/email.ts
functions/src/checks/dns.ts
functions/src/checks/domain.ts
functions/lib/                      (tutta — rigenerata con npm run build)
```

### File da modificare

#### `functions/src/index.ts`

```typescript
// Risultato finale — solo 4 export
export { internalChecks } from './checks/internalChecks'
export { onIncidentWrite } from './incidents/onIncidentWrite'
export { resolveStableUp } from './incidents/resolveStableUp'
export { weeklyHealthCheck } from './weeklyHealthCheck'
```

#### `functions/src/weeklyHealthCheck.ts`
- Rimuovere check UptimeRobot e Resend
- Tenere solo: Firestore connectivity + Telegram connectivity

#### `functions/src/incidents/onIncidentWrite.ts`
- Rimuovere logica invio email
- Tenere solo invio Telegram

---

## 10. Pulizia Firestore (rules, indexes, collections)

### `firestore.rules`

Rimuovere le regole per le collection non più usate:
- `webhookEvents`
- `webhookSecrets`
- `processedEvents`
- `resources`
- `dependencies`
- `secretRefs`
- `statusTokens` (se rimossi i token)

Opzionalmente mantenere le regole per `runbooks`, `tasks`, `reports`, `maintenanceWindows` come deny-all o rimuovere del tutto (i dati restano ma non sono accessibili da client).

### `firestore.indexes.json`

Rimuovere gli index compositi per:
- Qualsiasi index su `webhookEvents`, `processedEvents`, `webhookSecrets`
- Index su `maintenanceWindows` (se rimosso)
- Valutare quali index su `monitors` servono ancora (rimuovere quelli con `source` se non filtriamo più per source nella UI)

### Collections Firestore che restano attive

| Collection | Uso |
|------------|-----|
| `users` | Auth |
| `clients` | CRM |
| `services` | Core |
| `services/{id}/daily` | Storico (se teniamo dailyRollup, altrimenti rimuovere) |
| `monitors` | Core |
| `incidents` | Core |
| `incidents/{id}/timeline` | Core |
| `uptimeSamples` | Metriche (TTL 30 giorni) |
| `alertDedup` | Dedup alert (TTL) |
| `auditLog` | Audit trail |

---

## 11. Pulizia webhook route e API

### Route da eliminare

```
src/app/api/webhooks/               (tutta la cartella)
```

### Route da tenere

```
src/app/api/auth/                   (login/session/logout)
src/app/api/onboarding/submit/      (wizard submit — semplificato)
src/app/api/incidents/              (PATCH per aggiornare stato incidente)
```

### Route `/s/[token]/` (status page tokenizzata)

**Decisione:** se rimuoviamo i token, rimuovere anche questa route:
```
src/app/s/                          (tutta la cartella — solo se rimuoviamo tokens)
```

Altrimenti tenerla come feature semplice per condividere status page con clienti.

**Consiglio:** tenerla. È una feature utile e semplice. Ma rimuovere la UI admin di gestione token — i token si creano via script o Firestore console.

---

## 12. Semplificazione Settings e Health Check

### `/admin/settings/page.tsx`

Attualmente mostra 3 indicatori: UptimeRobot, Telegram, Resend.

**Dopo il refactoring:**
- Solo 1 indicatore: **Telegram** (connessione bot OK/KO)
- Profilo admin (UID, email, ruolo)
- Opzionalmente: versione app, ultimo deploy

---

## 13. Pulizia generale

### Test

| File test | Azione |
|-----------|--------|
| `tests/webhooks/normalize.test.ts` | ELIMINARE |
| `tests/checks/internalChecks.test.ts` | Aggiornare — rimuovere test per DNS e domain |
| `tests/incidents/transitions.test.ts` | Tenere — aggiornare se source types cambiano |
| `tests/status/projector.test.ts` | Tenere |
| `tests/rules.test.ts` | Aggiornare — rimuovere test per collection rimosse |

### Lib da valutare

```
src/lib/repos/        — tenere solo i repo per clients, services, monitors, incidents, audit
src/lib/status/       — tenere (status page pubblica)
src/lib/dashboard/    — tenere (KPI queries)
src/lib/incidents/    — tenere
src/lib/webhooks/     — ELIMINARE
```

### Docs

- Aggiornare `PHASE_10.2_MANUAL_TASKS.md`:
  - Rimuovere task per UptimeRobot, Resend, WHOIS API
  - Rimuovere task per webhook secrets
  - Semplificare Secret Manager (solo `telegram-bot-token`)
  - Aggiornare lista funzioni attese (da 7 a 4)
  - Aggiornare test checklist
- `COMMAND_CENTER_ARCHITECTURE.md` — aggiornare architettura semplificata

### `package.json`

Verificare e rimuovere dipendenze non più usate (se presenti):
- `resend` (se era una dipendenza diretta delle functions)
- Qualsiasi client WHOIS

### Environment variables non più necessarie

- `ALERT_FROM_EMAIL` — rimosso (no email)
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — **tenere** (App Check)
- `FIREBASE_ADMIN_SA_JSON` — **tenere**
- Tutte le `NEXT_PUBLIC_FIREBASE_*` — **tenere**

### Secrets non più necessari

- `resend-api-key` — rimuovere
- `uptimerobot-api-key` — rimuovere
- `whois-api-key` — rimuovere
- `telegram-bot-token` — **TENERE** (unico secret necessario)

---

## 14. Riepilogo struttura finale

### Architettura semplificata

```
┌──────────────────────────────────────────────┐
│            Next.js Admin UI                  │
│  /admin: dashboard, clients, services,       │
│          monitors, incidents, audit,         │
│          onboarding (4-step wizard)          │
└──────────────┬───────────────────────────────┘
               │
    ┌──────────▼──────────┐     ┌──────────────────────┐
    │    Firestore DB     │     │   Cloud Functions     │
    │                     │     │                       │
    │  clients            │◄────┤  internalChecks       │
    │  services           │     │    (HTTP + SSL, 15m)  │
    │  monitors           │     │                       │
    │  incidents          │     │  onIncidentWrite      │
    │  uptimeSamples      │     │    (→ Telegram alert) │
    │  alertDedup         │     │                       │
    │  auditLog           │     │  resolveStableUp      │
    │  users              │     │    (auto-resolve, 1m) │
    │                     │     │                       │
    │                     │     │  weeklyHealthCheck     │
    └─────────────────────┘     │    (Monday 08:00)     │
                                └──────────────────────┘
                                         │
                                    ┌────▼────┐
                                    │Telegram │
                                    │  Bot    │
                                    └─────────┘
```

### Wizard onboarding finale (4 step)

```
Step 1: Cliente       →  nome, contatto, Telegram, piano
Step 2: Servizio      →  nome, tipo, env, criticality, URL, visibilità
Step 3: Monitor       →  HTTP o SSL, intervallo, URL, alert Telegram
Step 4: Riepilogo     →  conferma e submit
```

### Sezioni admin finali (7 voci)

```
📊 Dashboard        — KPI + incident attivi + audit recente
👥 Clienti          — lista + dettaglio
🖥️ Servizi          — lista con filtri + dettaglio
📡 Monitor          — lista con ultimo check
🚨 Incidenti        — attivi + risolti recenti + dettaglio
➕ Nuovo progetto   — wizard 4 step
📝 Tasks            — lavagna todo/doing/done per progetto
⚙️ Impostazioni     — profilo + check Telegram
📋 Audit log        — cronologia attività
```

### Secret necessari (produzione)

| Secret | Dove |
|--------|------|
| `telegram-bot-token` | Google Secret Manager |
| `ADMIN_TELEGRAM_CHAT_ID` | Functions env var |
| `FIREBASE_ADMIN_SA_JSON` | Vercel env var |
| `NEXT_PUBLIC_FIREBASE_*` | Vercel env vars |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Vercel env var |

---

## Ordine di esecuzione consigliato

1. **Prima:** Sezioni 1-3 (rimozione UptimeRobot + DNS/Domain + Email) — sono indipendenti
2. **Poi:** Sezioni 4-6 (semplificazione tipi e modelli dati)
3. **Poi:** Sezione 7 (snellimento wizard — dipende dai nuovi tipi)
4. **Poi:** Sezione 8 (rimozione pagine admin)
5. **Poi:** Sezione 9 (Cloud Functions)
6. **Poi:** Sezioni 10-11 (Firestore + API routes)
7. **Infine:** Sezioni 12-13 (pulizia finale, test, docs)

> **Nota:** Dopo ogni macro-sezione, eseguire `npm run typecheck` (root + functions) per verificare che non ci siano errori di compilazione. I test vanno aggiornati man mano.

---

## Stima dell'impatto

| Metrica | Prima | Dopo (stima) |
|---------|-------|-------------|
| Pagine admin | 11 | 8 |
| Step wizard | 9 | 4 |
| Cloud Functions | 7 | 4 |
| Monitor sources | 5 | 2 |
| Alert channels | 2 | 1 |
| Service types | 17 | 10 |
| Resource types | 10 | 6 |
| Support plans | 6 | 3 |
| External secrets | 4 | 1 |
| Firestore collections attive | 18+ | 10 |
| File da eliminare | — | ~30-40 |
