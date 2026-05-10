# Command Center Alessio Bernardini — Implementation Document

> **Decisions locked in:**
> - Q1A — Public + tokenized status pages, no client login.
> - Q2A — Firestore-only with daily pre-aggregated rollups; raw events purged at 30 days.
> - Q3A — No auto-healing in MVP; manual runbook actions only.
> - Q4A — No agent in MVP; "actions" are tasks/reminders.
> - Q5A — Vercel hosting for the Next.js app.

---

## 0. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js (App Router) on Vercel — alessiobernardini.dev     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ /admin/*     │  │ /status/*    │  │ /s/{token}       │   │
│  │ (Auth req.)  │  │ (public)     │  │ (tokenized)      │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼───────────────────┼─────────────┘
          │ Firebase JS SDK │ Server-side reads via Admin SDK │
          ▼                 ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Firebase Project: korelab-cc                                │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐    │
│  │ Firestore   │ │ Auth (admin  │ │ Cloud Functions    │    │
│  │ (state)     │ │ only, MFA)   │ │ (webhooks, cron,   │    │
│  │             │ │              │ │  triggers)         │    │
│  └─────────────┘ └──────────────┘ └────────────────────┘    │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐    │
│  │ Secret Mgr  │ │ Cloud        │ │ App Check          │    │
│  │             │ │ Storage      │ │                    │    │
│  └─────────────┘ └──────────────┘ └────────────────────┘    │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
        UptimeRobot      Telegram Bot   SMTP/Resend
        (webhooks)       (alerts)       (email alerts)
```

**Key principles:**
- All admin writes go through Firestore directly with strict rules; no API layer needed for MVP.
- Public/tokenized reads happen **server-side** in Next.js Route Handlers using Firebase Admin SDK with service account, never exposing private fields.
- Cloud Functions own: webhook ingestion, scheduled checks (SSL/DNS/domain), incident lifecycle triggers, daily rollups, alert dispatch.
- Secrets live in **Google Secret Manager**, never in Firestore.

---

## 1. Firestore Data Model (flat + tag-based + edges)

### 1.1 Collections

```
/users/{uid}                        # admin operators (you)
/clients/{clientId}
/services/{serviceId}               # FLAT — every monitorable thing
/resources/{resourceId}             # infra items: docker host, k8s cluster, db, dns, ssl, repo
/dependencies/{depId}               # directed edges between services/resources
/monitors/{monitorId}               # mapping to UptimeRobot or internal checks
/incidents/{incidentId}             # FLAT — current + historical
/maintenanceWindows/{mwId}
/runbooks/{runbookId}
/tasks/{taskId}                     # manual actions queue
/reports/{reportId}                 # generated period reports
/auditLog/{logId}                   # security-relevant events only
/statusTokens/{tokenId}             # tokenized status page access
/secretsRefs/{refId}                # pointers, NEVER values
/webhookEvents/{eventId}            # raw webhook archive (TTL 30d)
/uptimeSamples/{sampleId}           # raw uptime events (TTL 30d)

# Subcollections (only where strictly bounded)
/services/{id}/daily/{yyyy-mm-dd}   # pre-aggregated rollups
/services/{id}/timeline/{eventId}   # capped operational events
/incidents/{id}/timeline/{eventId}  # incident timeline
```

### 1.2 Key documents

**`/clients/{clientId}`**
```ts
{
  id: string;
  name: string;
  businessType: 'agency' | 'ecommerce' | 'corporate' | 'startup' | 'other';
  contacts: Array<{ name: string; email: string; phone?: string; role: string; primary: boolean }>;
  notificationPrefs: {
    email: boolean; emails: string[];
    telegramChatId?: string;
    quietHours?: { start: string; end: string; tz: string };
  };
  supportPlan: 'none' | 'monitor-only' | 'reporting-only' | 'managed-support' | 'managed-infra' | 'auto-healing';
  contractRef?: { docUrl: string; signedAt: Timestamp; clausesAcceptedIds: string[] };
  consent: {
    monitoring: boolean;
    notification: boolean;
    intervention: boolean;
    autoHealing: boolean;
    consentedAt?: Timestamp;
  };
  tags: string[];
  notes: string;             // private
  status: 'active' | 'paused' | 'archived';
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

**`/services/{serviceId}`** (flat, the heart of the system)
```ts
{
  id: string;
  clientId: string;
  name: string;
  type: 'static-site' | 'landing' | 'corporate-site' | 'ecommerce' | 'saas' | 'api'
      | 'mobile-backend' | 'database' | 'docker-service' | 'k8s-deployment'
      | 'cron' | 'worker' | 'firebase-project' | 'external-saas' | 'domain' | 'email' | 'other';
  environment: 'production' | 'staging' | 'dev';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];                              // ['docker','prod','monitored','no-access']
  description: string;
  urls: { primary?: string; admin?: string; healthcheck?: string; docs?: string };
  expectedHealth?: { statusCode: number; bodyContains?: string };

  access: {
    level: 'none' | 'read-only' | 'operational' | 'admin';
    providers: string[];                       // ['hetzner','cloudflare','firebase']
    notes: string;
  };

  visibility: {
    statusPage: 'private' | 'tokenized' | 'public';
    reportSharing: 'private' | 'tokenized' | 'email';
  };

  automation: {
    mode: 'disabled' | 'manual-only' | 'manual-approval' | 'auto-low-risk';
    allowedActions: string[];                  // runbook action IDs
    cooldownMinutes: number;
    maxRetries: number;
  };

  // Denormalized current state (for cheap dashboard reads)
  currentStatus: {
    state: 'operational' | 'degraded' | 'partial-outage' | 'major-outage' | 'maintenance' | 'unknown';
    since: Timestamp;
    activeIncidentId?: string;
    lastCheckAt?: Timestamp;
    uptime30d?: number;                        // % rolled up nightly
  };

  monitorIds: string[];                        // refs to /monitors
  resourceIds: string[];                       // refs to /resources
  runbookIds: string[];

  createdAt: Timestamp; updatedAt: Timestamp;
}
```

**`/resources/{resourceId}`**
```ts
{
  id: string;
  kind: 'docker-host' | 'k8s-cluster' | 'db' | 'dns-zone' | 'ssl-cert' | 'domain' | 'repo' | 'firebase-project' | 'vps' | 'other';
  name: string;
  clientId?: string;                           // may be shared
  metadata: Record<string, any>;               // kind-specific, no secrets
  secretRefIds: string[];                      // pointers only
  tags: string[];
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

**`/dependencies/{depId}`**
```ts
{
  fromId: string; fromKind: 'service'|'resource';
  toId: string; toKind: 'service'|'resource';
  type: 'depends-on' | 'deploys-to' | 'uses' | 'routes-to';
  createdAt: Timestamp;
}
```

**`/monitors/{monitorId}`**
```ts
{
  id: string; serviceId: string; clientId: string;
  source: 'uptimerobot' | 'internal-http' | 'internal-ssl' | 'internal-dns' | 'internal-domain';
  externalId?: string;                         // UptimeRobot monitor id
  config: { intervalSec: number; url?: string; timeoutMs?: number; expectStatus?: number; expectBody?: string };
  alertChannels: { telegram: boolean; email: boolean; clientNotify: boolean };
  active: boolean;
  lastCheckAt?: Timestamp; lastResult?: 'up' | 'down' | 'degraded';
}
```

**`/incidents/{incidentId}`**
```ts
{
  id: string; serviceId: string; clientId: string;
  state: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'false-positive';
  severity: 'minor' | 'major' | 'critical';
  startedAt: Timestamp; resolvedAt?: Timestamp;
  source: 'uptimerobot' | 'internal-check' | 'manual';
  title: string;
  publicMessage?: string;                      // safe for status page
  privateMessage?: string;                     // only admin
  rootCause?: string; resolution?: string;
  visibility: 'private' | 'tokenized' | 'public';
  notifiedClient: boolean;
  metrics: { downtimeSec?: number };
}

// Subcollection
/incidents/{id}/timeline/{eventId}:
{
  at: Timestamp;
  kind: 'detected'|'updated'|'comment'|'resolved'|'reopened';
  message: string;
  byUid?: string;
}
```

**`/services/{id}/daily/{yyyy-mm-dd}`** (rollup; written by nightly Function)
```ts
{
  date: 'YYYY-MM-DD';
  uptimePct: number;
  downtimeSec: number;
  incidentCount: number;
  avgResponseMs?: number;
  checks: number;
  downChecks: number;
}
```

**`/statusTokens/{tokenId}`**
```ts
{
  token: string;          // long random, indexed unique — stored as sha256(rawToken)
  scope: 'client' | 'service'; targetId: string;
  expiresAt?: Timestamp; revokedAt?: Timestamp;
  allowedSections: ('status'|'incidents'|'reports'|'maintenance')[];
  createdAt: Timestamp; createdBy: string;
  lastUsedAt?: Timestamp;
}
```

**`/auditLog/{logId}`** (security-relevant only, not chatty UI events)
```ts
{
  at: Timestamp; actorUid?: string; actorKind: 'user'|'function'|'webhook';
  action: string; targetCollection: string; targetId: string;
  metadata?: any; ip?: string;
}
```

**`/reports/{reportId}`**
```ts
{
  id: string; serviceId: string; clientId: string;
  period: { kind: 'monthly'|'custom'; from: Timestamp; to: Timestamp; label: string };
  metrics: { uptimePct: number; downtimeSec: number; incidentCount: number; mttrSec?: number; avgResponseMs?: number; checks: number };
  incidents: Array<{ id: string; title: string; startedAt: Timestamp; resolvedAt?: Timestamp; downtimeSec?: number; severity: string; publicMessage?: string }>;
  maintenance: Array<{ id: string; startsAt: Timestamp; endsAt: Timestamp; title: string }>;
  notes: { client?: string; private?: string };
  visibility: 'private' | 'tokenized' | 'email';
  generatedAt: Timestamp; generatedBy: 'auto'|'manual'; generatedByUid?: string;
}
```

**`/runbooks/{runbookId}`**
```ts
{
  id: string; title: string;
  serviceTypes: string[];
  appliesToTags: string[];
  firstChecks: string[];
  contacts: string[];
  commonFailures: Array<{ symptom: string; likelyCause: string; fix: string }>;
  recoverySteps: Array<{ title: string; body: string; riskLevel: 'low'|'medium'|'high' }>;
  links: string[];
  notes: string;
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

**`/tasks/{taskId}`**
```ts
{
  id: string; title: string; description: string;
  serviceId?: string; incidentId?: string; runbookId?: string; runbookStepIndex?: number;
  state: 'todo'|'doing'|'done'|'cancelled';
  dueAt?: Timestamp; createdAt: Timestamp; completedAt?: Timestamp; notes: string;
}
```

### 1.3 Required composite indexes

- `services` where `clientId == X` order by `criticality desc, name asc`
- `services` where `currentStatus.state in [...]` order by `currentStatus.since desc`
- `services` where `tags array-contains X` order by `name`
- `incidents` where `state == 'investigating'` order by `startedAt desc`
- `incidents` where `clientId == X` order by `startedAt desc`
- `incidents` where `serviceId == X` order by `startedAt desc`
- `monitors` where `active == true` order by `lastCheckAt asc`

### 1.4 Retention rules (TTL)

- `webhookEvents`: TTL 30 days (Firestore TTL on `expiresAt`)
- `uptimeSamples`: TTL 30 days
- `services/{id}/timeline`: app-level cap at 200 entries via Function trigger
- `auditLog`: keep 18 months minimum

---

## 2. Security Rules Strategy

- **Admin collections** (`clients`, `services`, `resources`, `runbooks`, `tasks`, `auditLog`, `secretsRefs`, `webhookEvents`, `uptimeSamples`, `monitors`): readable/writable **only** if `request.auth.token.role == 'admin'`.
- **Status-facing reads** (`incidents`, `maintenanceWindows`, `services` minimal projection, `reports`): **never** read directly from the browser. Always proxied through Next.js Route Handlers using Admin SDK, which enforces token validity and field projection. Rules deny client reads entirely.
- **Tokenized access**: validated server-side by looking up `statusTokens` and applying `allowedSections`. Token is in URL path, never logged in analytics.
- **App Check** enabled on all admin client SDK calls.
- **MFA** required on admin Auth account.

---

## 3. Implementation Phases

### Mandatory Sonnet header (prepend to every phase prompt)

> **Project structure rules:**
> - Keep changes modular and file-separated.
> - No monolithic files.
> - Separate domains clearly.
> - Prefer minimal diffs.
> - Do not rewrite unrelated code.
> - Make each phase independently testable.

---

### Phase 1 — Project Setup, Auth, Base Layout

**Objective:** Bootstrap Next.js + Firebase + Tailwind, working admin login with MFA, App Check, base shell layout for `/admin`, and route protection.

**Scope:**
- Initialize Next.js 15 App Router project, TypeScript strict, Tailwind v4.
- Firebase project `korelab-cc` with: Firestore, Auth (Email/password + TOTP MFA enforced), App Check (reCAPTCHA v3), Functions (TS), Cloud Storage.
- Service account JSON for Vercel as `FIREBASE_ADMIN_SA_JSON` env var.
- Admin SDK singleton on server, Client SDK singleton on browser.
- Middleware-based route protection for `/admin/*`.
- Empty shell pages: `/admin`, `/admin/clients`, `/admin/services`, `/admin/incidents`, `/admin/monitors`, `/admin/reports`, `/admin/runbooks`, `/admin/tasks`, `/admin/audit`, `/admin/settings`.
- Public placeholder `/status` and tokenized route `/s/[token]`.

**Files/modules:**
```
src/
  app/
    layout.tsx, page.tsx
    admin/layout.tsx, page.tsx, [section]/page.tsx ...
    s/[token]/page.tsx
    status/page.tsx
    api/auth/session/route.ts        # exchange ID token → session cookie
  lib/
    firebase/client.ts               # browser SDK init
    firebase/admin.ts                # server Admin SDK init
    firebase/appcheck.ts
    auth/session.ts                  # session cookie create/verify
    auth/guards.ts                   # requireAdmin() server helper
  components/
    layout/AdminShell.tsx, Sidebar.tsx, Topbar.tsx
    auth/LoginForm.tsx, MfaEnrollPrompt.tsx
  middleware.ts                      # /admin/* gate via session cookie
```

**Firestore collections involved:** `/users/{uid}` (one document for you, with `role: 'admin'`).

**Cloud Functions involved:** none yet (callable function `setAdminClaim` invoked manually once via emulator/CLI to set the custom claim on your UID).

**Security:**
- Custom claim `role: 'admin'` is the gate; rules use `request.auth.token.role == 'admin'`.
- Session cookies are HttpOnly, Secure, SameSite=Lax, 5-day max age, refreshed via `/api/auth/session`.
- App Check enforced on Firestore from day 1.

**Acceptance criteria:**
- Visiting `/admin` while logged out → redirects to `/login`.
- Login requires email+password+TOTP.
- After login the admin shell renders with sidebar listing all sections.
- Service account secret is not bundled into client.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `functions/` exist and deploy cleanly to emulators.

**Testing checklist:**
- [ ] `pnpm dev` boots without errors.
- [ ] Firebase emulators start (`firestore`, `auth`, `functions`).
- [ ] Login flow works against emulator and prod.
- [ ] Middleware blocks `/admin` for unauthenticated requests.
- [ ] Lighthouse/console shows no leaked admin SDK in browser bundle.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 1 of the "Command Center" project: a Next.js 15 App Router app in TypeScript (strict mode) with Tailwind v4, integrated with Firebase (Firestore, Auth with email/password + TOTP MFA, App Check via reCAPTCHA v3, Cloud Functions in TypeScript, Cloud Storage). Target deployment is Vercel.

Required deliverables:
1. Project scaffold with `src/app`, `src/lib`, `src/components`, `functions/` directories matching the file map below.
2. Two Firebase SDK singletons: `src/lib/firebase/client.ts` (browser, reads `NEXT_PUBLIC_FIREBASE_*` envs) and `src/lib/firebase/admin.ts` (server, reads `FIREBASE_ADMIN_SA_JSON` from `process.env`).
3. Session cookie auth: `POST /api/auth/session` accepts a Firebase ID token, verifies it server-side, and sets an HttpOnly Secure SameSite=Lax cookie named `__session` (5 days). `DELETE` clears it. Provide `src/lib/auth/session.ts` and `src/lib/auth/guards.ts` with a `requireAdmin()` helper that throws if missing/invalid or if `role !== 'admin'`.
4. `src/middleware.ts` that gates `/admin/*` by checking the session cookie's existence (full verification happens server-side in pages).
5. Empty placeholder pages for: `/admin`, `/admin/clients`, `/admin/services`, `/admin/incidents`, `/admin/monitors`, `/admin/reports`, `/admin/runbooks`, `/admin/tasks`, `/admin/audit`, `/admin/settings`, plus `/status` and `/s/[token]`.
6. `AdminShell` layout component with sidebar (links to all admin sections), topbar with user email and logout button. Tailwind only, no UI lib.
7. `LoginForm` component with email/password + TOTP enrollment flow (use Firebase MFA SDK).
8. App Check initialization on the browser SDK only (do not break SSR).
9. `firebase.json`, `firestore.rules` (deny-all initial baseline allowing only `users/{uid}` self-read for `request.auth.uid == uid`), `firestore.indexes.json` (empty), `functions/src/index.ts` (empty exports object).
10. README section with setup steps for emulators (`firebase emulators:start --only auth,firestore,functions`).

File map:
src/
  app/
    layout.tsx, page.tsx
    admin/layout.tsx, page.tsx
    s/[token]/page.tsx
    status/page.tsx
    api/auth/session/route.ts
  lib/
    firebase/client.ts
    firebase/admin.ts
    firebase/appcheck.ts
    auth/session.ts
    auth/guards.ts
  components/
    layout/AdminShell.tsx
    layout/Sidebar.tsx
    layout/Topbar.tsx
    auth/LoginForm.tsx
    auth/MfaEnrollPrompt.tsx
  middleware.ts

Constraints:
- No UI library, no shadcn, no design system. Plain Tailwind classes.
- Do not implement any data flows yet. Only auth + shell.
- All server-only modules must `import 'server-only'` at the top.
- Do not commit any secrets. Provide `.env.example` only.
```

---

### Phase 2 — Firestore Schema, Rules, and Typed Repositories

**Objective:** Lock in the schema as TypeScript types, deploy security rules, create typed repositories used by all later phases.

**Scope:**
- Zod schemas for every collection in section 1.
- Firestore converters typed end-to-end.
- Security rules: admin-only writes, deny-all reads from client SDK on sensitive collections, App Check required.
- Repository modules with explicit query helpers (one per common access pattern).
- Indexes file populated.

**Files:**
```
src/lib/domain/
  schemas/client.ts, service.ts, resource.ts, monitor.ts, incident.ts,
           maintenance.ts, runbook.ts, task.ts, report.ts, statusToken.ts,
           auditLog.ts, dependency.ts, secretRef.ts
  types.ts
src/lib/repos/
  clientsRepo.ts, servicesRepo.ts, resourcesRepo.ts, monitorsRepo.ts,
  incidentsRepo.ts, maintenanceRepo.ts, runbooksRepo.ts, tasksRepo.ts,
  reportsRepo.ts, statusTokensRepo.ts, auditLogRepo.ts, dependenciesRepo.ts
src/lib/firebase/converters.ts
firestore.rules
firestore.indexes.json
```

**Cloud Functions:** none in this phase, but `functions/src/lib/repos/` mirrors the server-side repos (duplicated module for simplicity in MVP).

**Acceptance criteria:**
- Every collection has a Zod schema and a typed repo.
- Repos expose at minimum: `getById`, `list(filters)`, `create`, `update`, `softDelete` where applicable.
- Rules tests pass for: anonymous denied, non-admin denied, admin allowed, App Check enforced.
- Indexes file contains the composite indexes from section 1.3.

**Testing checklist:**
- [ ] `firebase emulators:exec --only firestore "vitest run rules.test.ts"` passes.
- [ ] Type-checking passes with no `any`.
- [ ] Each repo has at least one unit test against the emulator.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 2: Firestore schema, security rules, and typed repositories.

1. Create Zod schemas in `src/lib/domain/schemas/` for these collections, matching the field shapes provided in the architecture doc verbatim:
   - clients, services, resources, monitors, incidents (+ timeline subcollection event), maintenanceWindows, runbooks, tasks, reports, statusTokens, auditLog, dependencies, secretsRefs, services/{id}/daily rollup.

2. Create `src/lib/firebase/converters.ts` with a generic `zodConverter<T>(schema)` that produces a `FirestoreDataConverter<T>` for the Admin SDK.

3. Create one repository per collection in `src/lib/repos/`. Each repo:
   - Uses Admin SDK only (server-side).
   - Exposes `getById`, `list(filters)`, `create(input)`, `update(id, patch)`, and where applicable `archive(id)`.
   - For `servicesRepo`, additionally: `listByClient`, `listByTag`, `listByStatus`, `listCritical`, `listWithoutMonitor`, `listWithoutAccess`, `listWithActiveIncident`, `listAutoHealingEnabled`.
   - For `incidentsRepo`: `listActive`, `listByService`, `listByClient`, `appendTimelineEvent`.
   - All inputs validated with Zod before write.

4. Write `firestore.rules` enforcing:
   - All writes on every collection require `request.auth.token.role == 'admin'` AND App Check token present.
   - Reads on every collection are denied to client SDK except `users/{uid}` self-read.
   - Document-shape validation via `request.resource.data.keys().hasAll([...])` for critical fields.

5. Populate `firestore.indexes.json` with these composite indexes:
   - services: clientId == X, order criticality desc + name asc
   - services: currentStatus.state in [...], order currentStatus.since desc
   - services: tags array-contains X, order name
   - incidents: state == 'investigating', order startedAt desc
   - incidents: clientId == X, order startedAt desc
   - incidents: serviceId == X, order startedAt desc
   - monitors: active == true, order lastCheckAt asc

6. Add Firestore TTL config note in README for `webhookEvents.expiresAt` and `uptimeSamples.expiresAt`.

7. Tests in `tests/`:
   - `rules.test.ts` using `@firebase/rules-unit-testing` covering the access matrix.
   - One unit test per repo covering create+get+list against the Firestore emulator.

Constraints:
- No business logic in repos beyond validation and querying.
- Do not implement any UI in this phase.
- Do not introduce a state management library.
```

---

### Phase 3 — Client/Service Onboarding Wizard

**Objective:** A multi-step wizard that adapts to service type and support level, never overwhelming, with sensible defaults.

**Wizard steps (conditional):**

1. **Client** — pick existing or create new (name, business type, primary contact, support plan, consent toggles, contract reference).
2. **Service basics** — name, type, environment, criticality, tags, description, URLs.
3. **Health & monitoring** *(skipped if `supportPlan == 'none'`)* — monitor source, health endpoint, expected status/body, interval, alert channels.
4. **Access** *(skipped if `supportPlan in ['none','reporting-only']`)* — access level, providers, secret refs (paste Secret Manager resource names, never values).
5. **Resources & dependencies** *(optional, collapsible)* — link existing resources or create lightweight ones, declare dependencies.
6. **Visibility** — status page (private/tokenized/public), report sharing.
7. **Automation** *(only shown if `supportPlan == 'auto-healing'` AND `consent.autoHealing == true`)* — set to `disabled` by default in MVP regardless.
8. **Runbook** — pick existing or quick-create (first checks, contacts, common failures, recovery steps as free text + ordered list).
9. **Review & confirm** — diff view of what will be written.

**Files:**
```
src/app/admin/onboarding/page.tsx
src/components/onboarding/
  WizardShell.tsx, StepNav.tsx, StepClient.tsx, StepServiceBasics.tsx,
  StepMonitoring.tsx, StepAccess.tsx, StepResources.tsx, StepVisibility.tsx,
  StepAutomation.tsx, StepRunbook.tsx, StepReview.tsx
src/lib/onboarding/
  state.ts (React context only, no new deps)
  validators.ts (Zod step schemas)
  submit.ts (server action that performs a transactional write)
src/app/api/onboarding/submit/route.ts
```

**Firestore:** writes to `clients`, `services`, `monitors`, `resources`, `dependencies`, `runbooks`, `auditLog` in a single transaction.

**Cloud Functions:** Firestore trigger `onServiceCreated` stub (Phase 4 fills it in).

**Security:** server action verifies admin session; entire write is one transaction; logs audit entry.

**Default values enforced:**
- `automation.mode = 'disabled'` regardless of user input in MVP.
- `currentStatus.state = 'unknown'`, `currentStatus.since = serverTimestamp()`.
- `visibility.statusPage = 'private'` unless explicitly changed.

**Acceptance criteria:**
- Wizard adapts: monitoring step disappears for `monitor-only=false` plans; automation step disappears unless explicitly chosen.
- Step state persists to `sessionStorage` to survive accidental refresh.
- Review step shows diff and confirms.
- Submission is atomic; partial failure rolls back all writes.
- Audit log entry written.

**Testing checklist:**
- [ ] All conditional branches render correctly per support plan.
- [ ] Server action rejects unauthenticated calls.
- [ ] Transactional rollback verified by injecting a failure.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 3: the Client/Service Onboarding Wizard.

Use React Server Components + Server Actions where reasonable, and Client Components only where interactivity is required (the wizard itself).

Wizard flow (9 conditional steps):
1. Client — pick existing or create new (name, businessType, primary contact, supportPlan, consent toggles, contractRef).
2. Service basics — name, type, environment, criticality, tags, description, URLs.
3. Health & monitoring — skipped if supportPlan == 'none'. Monitor source, healthcheck endpoint, expected status/body, interval, alert channels.
4. Access — skipped if supportPlan in ['none','reporting-only']. Access level, providers, secret refs (Secret Manager resource names only, never values).
5. Resources & dependencies — optional, collapsible. Link existing resources or create lightweight ones, declare directed dependencies.
6. Visibility — statusPage (private/tokenized/public), reportSharing.
7. Automation — only shown if supportPlan == 'auto-healing' AND consent.autoHealing == true. Captured but forced to 'disabled' on write in MVP.
8. Runbook — pick existing or quick-create with firstChecks, contacts, commonFailures, recoverySteps.
9. Review — read-only diff of all collections that will be written.

Files to create:
src/app/admin/onboarding/page.tsx
src/components/onboarding/WizardShell.tsx
src/components/onboarding/StepNav.tsx
src/components/onboarding/StepClient.tsx
src/components/onboarding/StepServiceBasics.tsx
src/components/onboarding/StepMonitoring.tsx
src/components/onboarding/StepAccess.tsx
src/components/onboarding/StepResources.tsx
src/components/onboarding/StepVisibility.tsx
src/components/onboarding/StepAutomation.tsx
src/components/onboarding/StepRunbook.tsx
src/components/onboarding/StepReview.tsx
src/lib/onboarding/state.ts
src/lib/onboarding/validators.ts
src/lib/onboarding/submit.ts
src/app/api/onboarding/submit/route.ts

Behavioral requirements:
- Wizard state lives in a React Context provider (src/lib/onboarding/state.ts); no Zustand, no Redux, no new deps.
- Each step validated by a Zod schema in src/lib/onboarding/validators.ts. "Next" button disabled until current step is valid.
- Form state persisted to sessionStorage under key `cc:onboarding:v1` after every change.
- Review step renders a read-only diff of what will be written to each collection.
- Submission calls POST /api/onboarding/submit. The route handler:
  1. Calls requireAdmin().
  2. Validates entire payload with a composite Zod schema.
  3. Performs all writes (clients, services, monitors, resources, dependencies, runbooks) inside a single Firestore transaction via Admin SDK.
  4. Writes an auditLog entry with action: 'onboarding.create' referencing all created IDs.
  5. Returns { ok: true, ids: { clientId, serviceId, monitorIds, ... } } or { ok: false, error }.

UI requirements:
- Step navigation on the left, current step content on the right.
- Show "Step X of N" where N is dynamic based on conditional steps.
- Use only Tailwind classes; no UI library.

Tests:
- Unit test each Zod validator with valid + invalid examples.
- Integration test the submit route against the Firestore emulator: happy path and forced-failure rollback.
```

---

### Phase 4 — UptimeRobot Integration & Webhook Handling

**Objective:** Provision/sync UptimeRobot monitors, ingest webhooks, persist normalized events.

**Scope:**
- Server-side UptimeRobot client (API key in Secret Manager).
- Firestore trigger `onMonitorWrite`: creates/updates/pauses the corresponding UptimeRobot monitor, stores `externalId`.
- Webhook endpoint `POST /api/webhooks/uptimerobot/[secret]` with per-endpoint random token.
- Normalize webhook payload → write `webhookEvents`, `uptimeSamples`, update `monitors.lastResult`, dispatch to incident engine (Phase 5 stub).

**Files:**
```
functions/src/uptimerobot/client.ts
functions/src/uptimerobot/syncMonitor.ts          # Firestore trigger
functions/src/uptimerobot/types.ts
src/app/api/webhooks/uptimerobot/[secret]/route.ts
src/lib/webhooks/uptimerobot/normalize.ts
src/lib/webhooks/uptimerobot/verify.ts
```

**Firestore:** `monitors` (read/write), `webhookEvents` (write w/ TTL), `uptimeSamples` (write w/ TTL), `services.currentStatus.lastCheckAt` (update).

**Cloud Functions:** `onMonitorWrite` Firestore trigger.

**Security:**
- Webhook secret per-endpoint, stored in Secret Manager.
- Reject payloads larger than 16 KB.
- Idempotency: dedupe by `(monitorId, externalEventId)`.

**Acceptance criteria:**
- Creating a monitor in the wizard results in an UptimeRobot monitor with the right name, interval, URL.
- Pausing/deleting a monitor in Firestore reflects in UptimeRobot within seconds.
- Webhook ingestion is idempotent.
- All raw payloads archived with `expiresAt = now + 30d`.

**Testing checklist:**
- [ ] Mocked UptimeRobot API client tested.
- [ ] Webhook route tested with valid + invalid + replayed payloads.
- [ ] TTL field present on `webhookEvents` documents.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 4: UptimeRobot integration.

1. functions/src/uptimerobot/client.ts: thin TypeScript client for UptimeRobot's HTTP API supporting getMonitors, newMonitor, editMonitor, deleteMonitor. API key fetched from Google Secret Manager (secret name: uptimerobot-api-key) at cold start; cached for the function lifetime. Do not log the key.

2. functions/src/uptimerobot/syncMonitor.ts: a Firestore v2 onDocumentWritten('monitors/{id}') trigger that:
   - If source !== 'uptimerobot', exits.
   - On create: calls newMonitor with URL, interval, expected status; stores returned externalId.
   - On update: diffs config; calls editMonitor if URL/interval/expectations changed; calls pause/resume if active toggled.
   - On delete: calls deleteMonitor.
   - Idempotent: if externalId exists and config matches, no-op.

3. src/app/api/webhooks/uptimerobot/[secret]/route.ts:
   - Looks up the secret in secretsRefs to find the bound monitorId. If not found or revoked → 404.
   - Parses payload, runs through src/lib/webhooks/uptimerobot/normalize.ts to produce { monitorId, serviceId, kind: 'up'|'down'|'paused', at, responseTimeMs?, statusCode?, externalEventId }.
   - Writes a webhookEvents doc with expiresAt = now + 30d and the raw body.
   - Writes a uptimeSamples doc with expiresAt = now + 30d.
   - Updates monitors/{id}.lastResult and lastCheckAt.
   - Updates services/{id}.currentStatus.lastCheckAt.
   - Calls (stub) dispatchToIncidentEngine(event) from src/lib/incidents/engine.ts returning void for now.
   - Body size limit 16 KB; reject otherwise with 413.
   - Idempotency: dedupe by (monitorId, externalEventId) using a Firestore transaction on processedEvents/{key}.

4. Tests:
   - Unit tests for normalize.ts with sample UptimeRobot v2 payloads (up, down, paused).
   - Integration test the webhook route against emulator, including replay (same externalEventId twice → only one write).
   - Mocked test for syncMonitor covering create/update/delete/no-op paths.

Constraints:
- Do not import the Admin SDK from any file inside src/app/. Webhook routes use the thin server-only wrapper at src/lib/firebase/admin.ts.
- All UptimeRobot HTTP calls must have a 5s timeout and one retry with exponential backoff.
```

---

### Phase 5 — Incident Management

**Objective:** Turn normalized monitor events into incident lifecycle, with manual override, timeline, and visibility control.

**Incident state machine:** `investigating → identified → monitoring → resolved | false-positive`

**Engine rules:**
- `down` event + no active incident → create incident (`investigating`), severity derived from `service.criticality`.
- `down` event + active incident → append timeline event.
- `up` event + active incident → set `state='monitoring'`; after 5 min stable → `resolved`.
- Debounce: ignore single `down` if it flips back within 60s (configurable per monitor).
- Maintenance windows suppress incident creation during their interval.

**Files:**
```
src/lib/incidents/engine.ts
src/lib/incidents/transitions.ts
src/lib/incidents/severity.ts
functions/src/incidents/onIncidentWrite.ts        # alert dispatcher
functions/src/incidents/resolveStableUp.ts        # monitoring→resolved
functions/src/alerts/telegram.ts
functions/src/alerts/email.ts
src/app/admin/incidents/page.tsx
src/app/admin/incidents/[id]/page.tsx
src/components/incidents/IncidentList.tsx
src/components/incidents/IncidentDetail.tsx
src/components/incidents/IncidentTimeline.tsx
src/components/incidents/IncidentEditor.tsx
src/app/api/incidents/[id]/route.ts               # PATCH for manual updates
src/app/admin/maintenance/page.tsx
```

**Firestore:** `incidents`, `incidents/{id}/timeline`, `services.currentStatus`, `maintenanceWindows`.

**Cloud Functions:**
- `onIncidentWrite` (Firestore trigger): on state change → enqueue alerts.
- `resolveStableUp` (scheduled, every 1 min): scan `monitoring` incidents → if all monitors green ≥5 min → resolve.
- `cleanupTimelines` (scheduled, daily): cap `services/{id}/timeline` at 200 entries.

**Security:** Incident PATCH route requires admin; field-level validation; audit log on every change.

**Acceptance criteria:**
- Simulated `down` webhook creates an incident; `up` resolves it after stability window.
- Manual override: can mark `false-positive`, excluded from uptime rollups.
- Maintenance window suppresses new incidents.
- Telegram + email alerts deduplicated within 60s window.

**Testing checklist:**
- [ ] State machine table-driven test (every transition).
- [ ] Debounce correctly drops flapping events.
- [ ] Maintenance window suppression works.
- [ ] Alert dispatch deduped.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 5: Incident Management.

1. src/lib/incidents/transitions.ts: exhaustive table of allowed transitions among states: investigating | identified | monitoring | resolved | false-positive. Export canTransition(from, to) and apply(state, event) as pure functions.

2. src/lib/incidents/severity.ts: derives severity from service.criticality and event type.

3. src/lib/incidents/engine.ts exports dispatchToIncidentEngine(event) (called from Phase 4 webhook):
   - Within a Firestore transaction, finds the active incident for event.serviceId (if any).
   - Applies rules:
     - down + no active → create incident (investigating).
     - down + active → append timeline event.
     - up + active → set state='monitoring', record lastUpAt.
   - Debounces flapping: if last opposite event was <60s ago for the same monitor, drop current event and its sample.
   - Suppresses creation if a maintenanceWindows doc covers event.at for this service.
   - Updates services/{id}.currentStatus accordingly.

4. functions/src/incidents/resolveStableUp.ts: scheduled every 1 minute. For each incident in 'monitoring', if all service monitors have lastResult='up' for ≥5 minutes, transition to 'resolved', set metrics.downtimeSec.

5. functions/src/incidents/onIncidentWrite.ts: Firestore trigger. On state change:
   - Build admin alert (always) and client-safe alert (only if notifiedClient && client.consent.notification AND new state is investigating or resolved).
   - Enqueue to telegram.ts and email.ts.
   - Dedupe alerts using (incidentId, transition) key in Firestore for 60s.

6. functions/src/alerts/telegram.ts: sends via Telegram Bot API; bot token from Secret Manager (telegram-bot-token); chat ID from client.notificationPrefs.telegramChatId for client alerts; hard-coded admin chat from env for admin alerts.

7. functions/src/alerts/email.ts: sends via Resend (API key from Secret Manager resend-api-key).

8. UI:
   - /admin/incidents: list active + recent (last 30d) with filters by service, client, severity.
   - /admin/incidents/[id]: detail with timeline, editor for publicMessage, privateMessage, state, severity, visibility, notifiedClient, mark-as-false-positive button, manual close button.
   - /admin/maintenance: list/edit maintenanceWindows (start, end, services affected, public message).

9. PATCH /api/incidents/[id] server route:
   - requireAdmin().
   - Validates patch with Zod.
   - Uses transitions.canTransition if state changes; rejects illegal transitions with 409.
   - Appends a timeline event.
   - Writes audit log.

10. Tests:
    - Pure unit tests for transitions.ts (full table).
    - Engine tests with emulator covering: creation, debounce, flap suppression, maintenance suppression, monitoring→resolved.
    - Alert dispatcher tested with mocked HTTP clients; dedupe verified.

Constraints:
- Engine must be a pure module callable from both src/app/api/ (via Admin SDK) and functions/. Duplicate the file in both packages if needed.
- Never call Telegram/email synchronously from the webhook path; always go through the Firestore trigger.
```

---

### Phase 6 — Private Dashboard

**Objective:** The operational view: at-a-glance health, filtered service lists, service detail with all linked context.

**Pages & data reads:**
- `/admin` (Overview): counts of services by state, active incidents, services without monitor, services with expiring SSL (<30d), recent audit events.
- `/admin/clients` and `/admin/clients/[id]`: client list with support plan; detail with services, contacts, contract reference, consent matrix.
- `/admin/services`: filterable table — by client, environment, criticality, state, tag, "no monitor", "no access", "active incident".
- `/admin/services/[id]`: config, current status, monitors, linked resources, dependencies (in + out), recent incidents (paginated), runbooks, recent timeline.
- `/admin/monitors`: list, last result, last check, manual "run check now" for internal monitors only.
- `/admin/audit`: filterable audit log.
- `/admin/settings`: profile, MFA status, integration health (UptimeRobot, Telegram, Resend).

**Files:**
```
src/app/admin/page.tsx
src/app/admin/clients/page.tsx
src/app/admin/clients/[id]/page.tsx
src/app/admin/services/page.tsx
src/app/admin/services/[id]/page.tsx
src/app/admin/monitors/page.tsx
src/app/admin/audit/page.tsx
src/app/admin/settings/page.tsx
src/components/dashboard/StatusBadge.tsx
src/components/dashboard/KpiCard.tsx
src/components/dashboard/ServiceTable.tsx
src/components/dashboard/FilterBar.tsx
src/components/dashboard/DependencyGraph.tsx
src/components/services/ServiceHeader.tsx
src/components/services/MonitorPanel.tsx
src/components/services/ResourcePanel.tsx
src/components/services/IncidentPanel.tsx
src/components/services/RunbookPanel.tsx
src/components/services/TimelinePanel.tsx
src/lib/dashboard/queries.ts
```

**Security:** all pages are RSC; `requireAdmin()` at top of every server component.

**Acceptance criteria:**
- Overview loads <1s with 50 services in emulator.
- Filters work without N+1 queries.
- Service detail page surfaces every linked entity correctly.
- Settings page shows live integration health.

**Testing checklist:**
- [ ] Snapshot tests for table rendering with empty/large datasets.
- [ ] Smoke test each page renders for an authenticated admin.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 6: the Private Dashboard UI.

Use React Server Components for all /admin/* pages and call the existing repos from Phase 2 directly via Admin SDK. Do not introduce client-side data fetching libraries. Use Suspense boundaries for the slowest panels.

Pages required:
- /admin (Overview): service counts by state, active incidents list, services without monitor, services with expiring SSL (<30d), recent 10 audit events.
- /admin/clients: list with supportPlan badge; search by name.
- /admin/clients/[id]: detail — contacts, consent matrix, contractRef, list of services with status badges.
- /admin/services: URL-driven filterable table. Supported filters: ?client=&env=&state=&tag=&filter=no-monitor|no-access|active-incident. Filters are bookmarkable.
- /admin/services/[id]: reads in parallel (Promise.all): service, monitors, resources, dependencies (both directions), last 20 incidents, runbooks, last 50 timeline events.
- /admin/monitors: list all monitors with source, lastResult, lastCheckAt, active toggle.
- /admin/audit: filterable by action, actor, targetCollection. Paginated (20/page).
- /admin/settings: shows MFA status, and runs a server action pinging UptimeRobot, Telegram (getMe), and Resend (/domains) with 3s timeouts — renders three traffic-light statuses.

Component requirements:
- StatusBadge: maps states to Tailwind color classes (operational=green, degraded=amber, partial=orange, major=red, maintenance=blue, unknown=gray).
- DependencyGraph: simple SVG with nodes for service + linked resources and arrows for dependency edges. No chart library; hand-written SVG.
- ServiceTable: sticky header, max-height with scroll, shows "X of Y".
- FilterBar: reads URL search params and renders filter controls; on change pushes new URL with router.

Services list must use a SINGLE composed Firestore query per filter combination using indexes from Phase 2. Never fetch all and filter in memory.

Tests:
- One RSC integration test per page using the emulator and seeded fixtures.
- Filter URL parsing helper unit-tested.
```

---

### Phase 7 — Client / Status Pages

**Objective:** Public and tokenized status views with strict field projection.

**Routes:**
- `/status` — global public landing: lists services with `visibility.statusPage == 'public'`.
- `/status/[serviceSlug]` — public per-service status.
- `/s/[token]` — tokenized: validates token, renders allowed sections for bound client or service.

**Visible fields (after projection):**
- `name, state, since, uptime30d, daily90d (array of {date,uptimePct})`
- `activeIncident? {title, publicMessage, startedAt, severity}`
- `recentIncidents [{title, publicMessage, startedAt, resolvedAt, downtimeSec, severity}]` (last 10)
- `maintenance [{title, publicMessage, startsAt, endsAt}]`
- `latestReport? {id, periodLabel, url}` if reports are allowed.

**Never exposed:** internal notes, root cause, infrastructure details, resources, dependencies, monitor configs, other clients' data.

**Files:**
```
src/app/status/page.tsx
src/app/status/[slug]/page.tsx
src/app/s/[token]/page.tsx
src/lib/status/projector.ts
src/lib/status/tokens.ts
src/components/status/StatusHeader.tsx
src/components/status/ServiceCard.tsx
src/components/status/UptimeBar.tsx
src/components/status/IncidentList.tsx
src/components/status/MaintenanceList.tsx
```

**Security:**
- Projector is the single source of truth for what fields leak. Unit test asserts no extra fields appear.
- Tokens stored as `sha256(rawToken)`; URL contains raw token.
- `Cache-Control: private, max-age=30` on tokenized; `public, max-age=60, s-maxage=60` on public.
- Tokenized routes set `X-Robots-Tag: noindex, nofollow`.

**Acceptance criteria:**
- Public page contains zero fields beyond projector whitelist (verified by snapshot + type test).
- Revoked or expired token → 404.
- Tokenized page logs `lastUsedAt` and an `auditLog` entry on first daily access per token.

**Testing checklist:**
- [ ] Projector exhaustive field test.
- [ ] Token expiry/revocation paths.
- [ ] Public page hides services that aren't `public`.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 7: public and tokenized status pages.

1. src/lib/status/projector.ts exports a single function projectServiceForStatus(service, incidents, dailyRollups, maintenance, allowedSections) that returns a strict TypeScript type PublicServiceView containing ONLY these fields:
   - name, state, since, uptime30d, daily90d (array of {date,uptimePct})
   - activeIncident?: {title, publicMessage, startedAt, severity}
   - recentIncidents: [{title, publicMessage, startedAt, resolvedAt, downtimeSec, severity}] (last 10)
   - maintenance: [{title, publicMessage, startsAt, endsAt}]
   - latestReport?: {id, periodLabel, url} if reports allowed
   Write a TypeScript test that imports the function and checks via Exclude that no extra keys exist on the return type.

2. src/lib/status/tokens.ts:
   - Tokens stored as sha256(rawToken) in statusTokens.token. URL contains raw token.
   - validateToken(rawToken) returns the token doc or null. Constant-time compare.
   - On valid use, update lastUsedAt; once per day per token, write an auditLog entry with action: 'status.token.used'.

3. Routes:
   - /status (RSC): list services with visibility.statusPage == 'public', show ServiceCard with mini uptime bar.
   - /status/[slug] (RSC): full public view for a single service with visibility.statusPage == 'public'.
   - /s/[token] (RSC): validate token; render allowed sections per allowedSections. Scope can be single service or whole client (then list its visible services).

4. Cache headers:
   - /status*: Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300
   - /s/*: Cache-Control: private, max-age=30, no-store and X-Robots-Tag: noindex, nofollow

5. Components (presentational only): StatusHeader, ServiceCard, UptimeBar (90 colored squares from daily rollups), IncidentList, MaintenanceList.

6. Tests:
   - Projector exhaustive field test.
   - Token validation: valid, expired, revoked, unknown.
   - Public list excludes non-public services.
   - Tokenized page shows only allowedSections.

Constraints:
- No client SDK on these routes. Reads happen server-side only.
- Do not link the admin layout from these routes.
```

---

### Phase 8 — Reporting

**Objective:** Generate per-period reports from rollups; visible in admin and on tokenized status page.

**Scope:**
- Nightly Function `dailyRollup` writes `services/{id}/daily/{yyyy-mm-dd}`.
- Monthly Function `generateMonthlyReports` (1st of month, 03:00 UTC) creates reports for eligible services.
- Manual "Generate report" action for any period.
- Report renderer: server component renders to HTML; PDF/email deferred.

**Files:**
```
functions/src/reports/dailyRollup.ts
functions/src/reports/generateMonthlyReports.ts
functions/src/reports/buildReport.ts
src/app/admin/reports/page.tsx
src/app/admin/reports/[id]/page.tsx
src/app/api/reports/generate/route.ts
src/components/reports/ReportView.tsx
src/components/reports/MetricsBlock.tsx
src/components/reports/IncidentTable.tsx
src/components/reports/MaintenanceTable.tsx
```

**Acceptance criteria:**
- Daily rollup produces correct uptime % from samples (hand-computed test fixture).
- Monthly auto-generation creates one report per eligible service.
- Manual generation works for arbitrary date range.
- Report visible in admin and surfaced via projector in status page.

**Testing checklist:**
- [ ] Rollup math test with synthetic samples.
- [ ] Monthly job dry-run test.
- [ ] Authorization on `POST /api/reports/generate`.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 8: Reporting.

1. functions/src/reports/dailyRollup.ts: scheduled daily 02:00 UTC. For each active service, aggregate the previous day's uptimeSamples (count up/down, derive uptimePct and downtimeSec based on monitor interval) and incidents started or open in the day; write services/{id}/daily/{yyyy-mm-dd}.

2. functions/src/reports/buildReport.ts exports buildReport({ serviceId, from, to, generatedBy, generatedByUid? }):
   - Reads daily rollups in range, incidents overlapping range, maintenance windows in range.
   - Computes metrics as defined in the report schema.
   - Returns the reports document body (does not write).

3. functions/src/reports/generateMonthlyReports.ts: scheduled monthly on the 1st at 03:00 UTC. For each service whose client supportPlan is in ['reporting-only','managed-support','managed-infra','auto-healing'], calls buildReport for the previous calendar month and writes the reports doc with generatedBy: 'auto'. Idempotent by (serviceId, period.label).

4. POST /api/reports/generate (admin): body { serviceId, from, to, visibility }. Calls requireAdmin, writes the report. Audit log entry.

5. UI:
   - /admin/reports: filterable list by client, service, period.
   - /admin/reports/[id]: rendered report using ReportView. "Mark as ready to share" button toggles visibility.
   - ReportView is print-friendly (Tailwind print classes). PDF generation deferred.

6. Tests:
   - Synthetic-fixture math test: 24h with 6 down samples at 5-min interval → expected uptimePct and downtimeSec.
   - Idempotency test for monthly job.
   - Auth tests for the generate endpoint.

Constraints:
- Do not implement PDF generation in this phase.
- Do not implement email sending of reports in this phase.
- All time math in UTC; period labels formatted with Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).
```

---

### Phase 9 — Runbooks and Manual Actions (Tasks)

**Objective:** Codify "what to do when X breaks" and provide a manual task queue. No remote execution.

**Scope:**
- Runbook editor with structured fields + Markdown body.
- "Create task from runbook step" on incident detail.
- `/admin/tasks`: kanban-lite (todo / doing / done).
- Each task references `serviceId`, `incidentId?`, `runbookId?`.

**Files:**
```
src/app/admin/runbooks/page.tsx
src/app/admin/runbooks/[id]/page.tsx
src/app/admin/runbooks/new/page.tsx
src/app/admin/tasks/page.tsx
src/components/runbooks/RunbookList.tsx
src/components/runbooks/RunbookEditor.tsx
src/components/runbooks/RunbookView.tsx
src/components/tasks/TaskBoard.tsx
src/components/tasks/TaskCard.tsx
src/components/tasks/TaskEditor.tsx
src/app/api/tasks/route.ts                 # POST create
src/app/api/tasks/[id]/route.ts            # PATCH state/fields
```

**Acceptance criteria:**
- Runbooks created/edited; visible from service detail and incident detail.
- Tasks created from incident "convert step to task"; status updates work; audit logged.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 9: Runbooks and Tasks.

1. Runbook schema fields: id, title, serviceTypes[], appliesToTags[], firstChecks[], contacts[], commonFailures[{symptom, likelyCause, fix}], recoverySteps[{title, body, riskLevel: 'low'|'medium'|'high'}], links[], notes, createdAt, updatedAt. Markdown allowed in body fields.

2. CRUD pages under /admin/runbooks with a textarea + preview pane for Markdown (no heavy library deps).

3. Service detail and Incident detail pages (Phases 5/6) get a "Linked runbooks" panel listing matching runbooks (by serviceType or tag) plus explicitly linked ones.

4. Tasks:
   - Schema: id, title, description, serviceId?, incidentId?, runbookId?, runbookStepIndex?, state: 'todo'|'doing'|'done'|'cancelled', dueAt?, createdAt, completedAt?, notes.
   - POST /api/tasks and PATCH /api/tasks/[id] with admin guard + audit log.
   - On Incident detail, each runbook recovery step has "Create task" → opens prefilled editor.
   - /admin/tasks shows three columns (todo/doing/done) with drag-free state toggles via buttons.

5. Tests for the API routes (auth + state transitions).

Constraints:
- No remote execution. Tasks are reminders only.
- No new heavy deps; prefer plain textareas for Markdown.
```

---

### Phase 10 — Internal Checks Layer (SSL, DNS, Domain, Custom HTTP)

**Objective:** Cover gaps UptimeRobot doesn't address. Promoted to MVP-critical.

**Scope:**
- Scheduled Function `internalChecks` runs every 15 min.
- SSL: TLS handshake, extract cert, compute `daysToExpiry`. Alert at <30d, <14d, <7d, <2d (each once).
- DNS: resolve expected records; alert on drift.
- Domain: WHOIS lookup (API key from Secret Manager); alert at <60d, <30d, <7d.
- HTTP: GET expected URL, check status + body fragment.
- Results feed into the same incident engine as UptimeRobot events.

**Files:**
```
functions/src/checks/internalChecks.ts
functions/src/checks/ssl.ts
functions/src/checks/dns.ts
functions/src/checks/domain.ts
functions/src/checks/http.ts
functions/src/checks/alertLadder.ts
```

**Acceptance criteria:**
- SSL monitor produces an alert when test cert is <7d.
- DNS drift detected and alert fires once per change.
- Domain expiry warns at right thresholds.

**Testing checklist:**
- [ ] Mock TLS / DNS / fetch / WHOIS; cover happy path, expiry crossings, drift.
- [ ] Alert ladder test: same threshold trips only once.

**Sonnet prompt:**

```
Project structure rules:
- Keep changes modular and file-separated.
- No monolithic files.
- Separate domains clearly.
- Prefer minimal diffs.
- Do not rewrite unrelated code.
- Make each phase independently testable.

Implement Phase 10: Internal Checks Layer.

1. Scheduled function internalChecks runs every 15 minutes. Pulls all monitors where active == true && source in ['internal-ssl','internal-dns','internal-domain','internal-http'] and dispatches each to the right checker.

2. Checkers in functions/src/checks/:
   - ssl.ts: TLS handshake using Node tls module to host:port from monitor config; extract valid_to; compute daysToExpiry.
   - dns.ts: resolves configured record types (A/AAAA/CNAME/MX/TXT) and compares with expected values stored on monitor; emits 'down' if drift.
   - domain.ts: calls a WHOIS API (key from Secret Manager whois-api-key); extracts expiry date.
   - http.ts: fetch with 5s timeout, asserts status and optional body fragment.

3. alertLadder.ts: helper that records "I already alerted at threshold X" on the monitor doc to avoid alert spam. Threshold sets:
   - SSL: [30, 14, 7, 2] days.
   - Domain: [60, 30, 7] days.

4. Each check, on failure or threshold trip, calls dispatchToIncidentEngine (Phase 5) with a normalized event. SSL/domain warnings open a 'degraded' incident with severity 'minor' and publicMessage empty by default.

5. Tests:
   - Mock TLS / DNS / fetch / WHOIS; cover happy path, expiry crossings, drift.
   - Alert ladder test: same threshold trips only once.

Constraints:
- All network calls have timeouts and one retry with backoff.
- No raw secrets in code.
```

---

### Phase 11 — Future: Safe Auto-Healing Agent (deferred, design-only)

**Status: NOT in MVP.** Designed now so the data model accommodates it.

**Architecture (when built):**
- Small Go or Node binary (`cc-agent`) installed on infrastructure I control.
- Agent registers with Firestore via one-time bootstrap secret → receives per-agent signing keypair.
- `commands` collection holds signed work items: `{ agentId, action, params, signature, expiresAt, dryRun }`.
- Agent long-polls Firestore for new commands assigned to its `agentId`.
- Agent verifies signature, validates action is in local whitelist, executes, writes result back.
- Cloud Function `enqueueCommand` is the only writer to `commands`. It enforces:
  - Service has `automation.mode != 'disabled'`.
  - Action is in `service.automation.allowedActions`.
  - Client `consent.autoHealing == true` AND `contractRef.clausesAcceptedIds` contains the auto-healing clause.
  - Cooldown not violated.
  - Rate limit (per-service, per-client, global).
  - Medium/high risk actions require manual approval doc in `approvals/`.
- All actions audited.

**Data model additions (define as optional fields in Phase 2 schema only):**
```ts
// /agents/{agentId}
{ name, registeredAt, publicKey, lastSeenAt, allowedResourceIds[], status }

// /commands/{cmdId}
{ agentId, serviceId, action, params, dryRun, signature, state: 'queued'|'claimed'|'done'|'failed'|'expired', enqueuedAt, claimedAt?, completedAt?, result? }

// /approvals/{appId}
{ commandId, requestedBy, approvedBy?, decision: 'pending'|'approved'|'rejected', at }
```

**Sonnet prompt:** *Not produced — this phase is intentionally deferred. Revisit only after ≥3 months of incident history per service.*

---

## 4. Cross-Cutting Concerns

### 4.1 Environment & secrets

- `.env.example` lists required vars; nothing real committed.
- Vercel project: `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_SA_JSON`, `APPCHECK_SITE_KEY`.
- Functions runtime: secrets bound via `defineSecret()` from `firebase-functions/params`:
  - `UPTIMEROBOT_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `RESEND_API_KEY`
  - `WHOIS_API_KEY`
  - `ADMIN_TELEGRAM_CHAT_ID`

### 4.2 Observability

- Cloud Logging for all Functions; structured JSON logs with `serviceId`, `incidentId`, `monitorId` as labels.
- Sentry on Next.js (server + client) — optional but recommended.
- A weekly self-check Function pings each integration and posts to your Telegram.

### 4.3 Cost controls

- Firestore TTL for `webhookEvents`, `uptimeSamples`, `processedEvents`.
- Daily rollups eliminate hot reads on raw samples.
- Dashboard pages always use bounded queries with `limit()`.
- App Check stops abuse against client SDK calls.
- Function concurrency caps: `maxInstances: 5` per function.

### 4.4 Project layout

```
/                      # Next.js app at repo root
  src/
  public/
  package.json
/functions/            # Cloud Functions (separate package.json)
/firestore.rules
/firestore.indexes.json
/firebase.json
/.env.example
```

---

## 5. Recommended Phase Build Order

1. Phase 1 — Setup, Auth, Shell
2. Phase 2 — Schema, Rules, Repos
3. Phase 3 — Onboarding Wizard
4. Phase 4 — UptimeRobot
5. Phase 5 — Incidents (+ alerts)
6. Phase 6 — Private Dashboard
7. Phase 10 — Internal Checks *(before status page so SSL/domain warnings exist)*
8. Phase 7 — Status Pages
9. Phase 8 — Reporting
10. Phase 9 — Runbooks & Tasks
11. Phase 11 — Auto-healing agent *(deferred)*
