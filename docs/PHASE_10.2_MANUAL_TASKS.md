# Phase 10.2 — Manual Setup Tasks & Test Checklist

> **Status:** Codebase is complete (Phases 1–10 + cross-cutting). This document
> lists the **physical/manual** tasks you must perform on Firebase, Vercel, and
> external services before the Command Center can run end-to-end, plus a
> structured **test plan** to validate each subsystem once everything is wired.

---

## Part A — Manual Setup Tasks (do these once, in order)

### A.1 — Firebase project provisioning

**Console: <https://console.firebase.google.com/project/korelab-cc>**

- [X] **A.1.1** Create / confirm the project `korelab-cc` exists.
- [X] **A.1.2** Enable **Firestore** (Native mode, region: `eur3` or `europe-west` of your choice).
- [X] **A.1.3** Enable **Authentication** → Sign-in method → enable **Email/Password**.
- [ ] **A.1.4** In Authentication → Settings → **Multi-factor authentication** → enable **TOTP** as an MFA option. - non trovo l'opzione tra le scelte su 'metodo di accesso'
- [X] **A.1.5** Enable **Cloud Functions** (requires upgrading the project to **Blaze** pay-as-you-go plan).
- [X] **A.1.6** Enable **Cloud Storage** (default bucket).
- [X] **A.1.7** Enable **App Check**:
  - Register a Web App (if not already).
  - Add **reCAPTCHA v3** as the App Check provider for the web app.
  - Generate a reCAPTCHA v3 site key at <https://www.google.com/recaptcha/admin>.
  - Copy the site key into `.env.local` as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
  - **Enforce** App Check on Firestore (toggle ON after the app has been running for ≥1 day to avoid breakage). enforce da fare (quando sarà ok da 1gg)
- [X] **A.1.8** Generate a service account JSON: Project Settings → Service Accounts → **Generate new private key**.
  - Save the file locally **outside the repo**.
  - Convert it to a single-line string (e.g. `cat sa.json | jq -c .`) and paste into `.env.local` as `FIREBASE_ADMIN_SA_JSON`.

### A.2 — Firestore deployment

```bash
# From repo root, with Firebase CLI logged in as the project owner
firebase deploy --only firestore:rules,firestore:indexes
```

- [ ] **A.2.1** Deploy `firestore.rules`.
- [ ] **A.2.2** Deploy `firestore.indexes.json` (9 composite indexes — building can take 5–15 min).
- [ ] **A.2.3** Set TTL policies in **Firestore Console → Indexes → TTL**:
  - `webhookEvents.expiresAt`
  - `uptimeSamples.expiresAt`
  - `processedEvents.expiresAt`
  - `alertDedup.expiresAt`

### A.3 — Google Secret Manager

```bash
# Open Cloud Shell or a terminal with `gcloud` authenticated to korelab-cc
gcloud config set project korelab-cc

for s in telegram-bot-token resend-api-key uptimerobot-api-key whois-api-key; do
  gcloud secrets create "$s" --replication-policy="automatic"
done
```

- [ ] **A.3.1** Create the four secrets above.
- [ ] **A.3.2** Add a value to each:
  ```bash
  echo -n "REAL_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
  ```
- [ ] **A.3.3** Grant the Cloud Functions runtime service account `roles/secretmanager.secretAccessor` on each secret:
  ```bash
  gcloud secrets add-iam-policy-binding SECRET_NAME \
    --member="serviceAccount:korelab-cc@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
  ```

### A.4 — External services to provision

- [ ] **A.4.1** **Telegram Bot**: create via [@BotFather](https://t.me/BotFather) → save token → store as `telegram-bot-token` secret. Get your personal chat ID from [@userinfobot](https://t.me/userinfobot) → set in functions env var `ADMIN_TELEGRAM_CHAT_ID`.
- [ ] **A.4.2** **Resend account**: create at <https://resend.com> → verify your sending domain (e.g. `alessiobernardini.dev`) → generate API key → store as `resend-api-key` secret.
- [ ] **A.4.3** **UptimeRobot account**: create at <https://uptimerobot.com> → Settings → API Settings → generate **Main API Key** → store as `uptimerobot-api-key` secret.
- [ ] **A.4.4** **WHOIS JSON API**: register at <https://whoisjsonapi.com> → get API token → store as `whois-api-key` secret.

### A.5 — Cloud Functions deployment

- [ ] **A.5.1** Set environment variables for the Functions runtime. Create `functions/.env` (or use `firebase functions:config:set`):
  ```
  ADMIN_TELEGRAM_CHAT_ID=123456789
  ALERT_FROM_EMAIL=alerts@alessiobernardini.dev
  ```
- [ ] **A.5.2** Build and deploy:
  ```bash
  cd functions
  npm install
  npm run build
  cd ..
  firebase deploy --only functions
  ```
- [ ] **A.5.3** Verify in Firebase Console → Functions that all 7 functions show **active**:
  - `syncUptimeRobotMonitor`
  - `onIncidentWrite`
  - `resolveStableUp` (every 1 min)
  - `dailyRollup` (00:05 UTC)
  - `generateMonthlyReports` (01:00 UTC, 1st of month)
  - `internalChecks` (every 15 min)
  - `weeklyHealthCheck` (Monday 08:00 UTC)

### A.6 — Vercel deployment

- [ ] **A.6.1** Push the repo to GitHub.
- [ ] **A.6.2** Import into Vercel → connect the repo → framework preset: **Next.js**.
- [ ] **A.6.3** Set the following environment variables in Vercel → Settings → Environment Variables (Production + Preview):
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
  - `FIREBASE_ADMIN_SA_JSON` (single-line JSON)
- [ ] **A.6.4** Deploy. Confirm build succeeds and `https://alessiobernardini.dev/login` loads.
- [ ] **A.6.5** Set the custom domain `alessiobernardini.dev` in Vercel → Domains.

### A.7 — First admin user

- [ ] **A.7.1** Open `https://alessiobernardini.dev/login` and sign up your admin email/password.
- [ ] **A.7.2** From the Firebase Auth console, copy your **UID**.
- [ ] **A.7.3** Locally, with `.env.local` populated, run:
  ```bash
  npm run set-admin -- <YOUR_UID>
  ```
- [ ] **A.7.4** Sign out and back in. Confirm `/admin` loads.
- [ ] **A.7.5** Enroll TOTP MFA from `/admin/settings` (or wherever the MFA prompt lives).

### A.8 — UptimeRobot webhook secret per monitor

For every UptimeRobot monitor that the system creates, you must register a webhook secret in Firestore:

- [ ] **A.8.1** Generate a 32-byte random hex secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **A.8.2** In an admin tool (or a small script), call `registerWebhookSecret(rawSecret, monitorId)` from `src/lib/webhooks/uptimerobot/verify.ts` to store its SHA-256 hash in `webhookSecrets`.
- [ ] **A.8.3** In UptimeRobot → Monitor → Alert Contacts → add a **Webhook** with URL:
  ```
  https://alessiobernardini.dev/api/webhooks/uptimerobot/<RAW_SECRET>
  ```

---

## Part B — Test Checklist (verify each subsystem)

> Run these in order. Each item is independently verifiable. Mark each as you go.

### B.1 — Auth & shell (Phase 1)

- [ ] **B.1.1** Visit `/admin` while logged out → redirected to `/login`.
- [ ] **B.1.2** Wrong password → error shown, no redirect.
- [ ] **B.1.3** Correct password + MFA prompt → land on `/admin`.
- [ ] **B.1.4** Open DevTools → Application → Cookies → confirm `__session` is `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] **B.1.5** `DELETE /api/auth/session` (logout) clears the cookie and redirects.
- [ ] **B.1.6** Browser bundle does **not** contain `firebase-admin` (search via Sources tab).

### B.2 — Firestore schema & rules (Phase 2)

- [ ] **B.2.1** From Firebase emulator, run `npm test -- tests/rules.test.ts`. All 17 tests pass.
- [ ] **B.2.2** From a logged-out browser, attempt to read `clients` via the JS SDK → permission denied.
- [ ] **B.2.3** From a logged-in non-admin browser, attempt to read `services` → permission denied.
- [ ] **B.2.4** From admin, create/read/update/delete works on every collection via the admin pages.

### B.3 — Onboarding wizard (Phase 3)

- [ ] **B.3.1** `/admin/onboarding` loads.
- [ ] **B.3.2** Create new client + new service end-to-end. All 9 steps render conditionally based on support plan.
- [ ] **B.3.3** Refresh the page mid-wizard → state survives (sessionStorage).
- [ ] **B.3.4** Submit → redirected to service detail; check Firestore: `clients`, `services`, `monitors`, `runbooks`, `auditLog` all have the new docs in one transaction.
- [ ] **B.3.5** Force a validation error in step 2 → cannot proceed, errors shown inline.

### B.4 — UptimeRobot integration (Phase 4)

- [ ] **B.4.1** Create a monitor via the wizard with `source: uptimerobot`. Check Firebase Functions logs → `syncUptimeRobotMonitor` ran successfully and `monitors/{id}.externalId` is populated.
- [ ] **B.4.2** Confirm the monitor appears in your UptimeRobot dashboard.
- [ ] **B.4.3** Toggle `active: false` on the monitor → UptimeRobot pauses it within ~30 sec.
- [ ] **B.4.4** Trigger a webhook manually via curl with a valid signed payload → returns 200, `webhookEvents` doc created with `expiresAt` set.
- [ ] **B.4.5** Replay the same payload → returns `{ ok: true, duplicate: true }`, no second `webhookEvents` doc.
- [ ] **B.4.6** Send a payload >16 KB → 413.
- [ ] **B.4.7** Send a payload to `/api/webhooks/uptimerobot/INVALID` → 404.

### B.5 — Incident management (Phase 5)

- [ ] **B.5.1** Run `npm test -- tests/incidents/transitions.test.ts` → 27 tests pass.
- [ ] **B.5.2** Force a `down` webhook → an `incidents` doc is created in `investigating`, `services.currentStatus.state` flips to `major-outage` or `degraded`.
- [ ] **B.5.3** Within 60 sec, force an `up` event for the same monitor → debounced (no state change).
- [ ] **B.5.4** Force a `down` then wait 90 sec, then `up` → incident transitions to `monitoring`. Wait 5+ min → `resolveStableUp` flips it to `resolved` and writes `metrics.downtimeSec`.
- [ ] **B.5.5** Manually mark an incident `false-positive` → state changes, `auditLog` entry written.
- [ ] **B.5.6** Verify Telegram admin alert arrives within 30 sec of state change.
- [ ] **B.5.7** Verify a duplicate state-change does NOT re-trigger Telegram (alertDedup, 60 sec window).
- [ ] **B.5.8** Create a `maintenanceWindows` covering now → trigger a `down` event → no incident is created.

### B.6 — Private dashboard (Phase 6)

- [ ] **B.6.1** `/admin` loads with KPIs (services count by state, active incidents, services without monitor, recent audit events).
- [ ] **B.6.2** `/admin/clients` lists clients with support plan badges.
- [ ] **B.6.3** `/admin/clients/[id]` shows contacts, consent matrix, list of services.
- [ ] **B.6.4** `/admin/services` filters work via URL params: `?env=production&state=operational&filter=no-monitor`.
- [ ] **B.6.5** `/admin/services/[id]` renders monitors, resources, dependencies SVG, recent incidents, runbooks.
- [ ] **B.6.6** `/admin/monitors` lists all monitors with `lastResult`, `lastCheckAt`.
- [ ] **B.6.7** `/admin/audit` paginates correctly.
- [ ] **B.6.8** `/admin/settings` shows three traffic lights: UptimeRobot, Telegram, Resend, all green.

### B.7 — Status pages (Phase 7)

- [ ] **B.7.1** Run `npm test -- tests/status/projector.test.ts` → 11 tests pass.
- [ ] **B.7.2** `/status` (no auth) loads and lists only services with `visibility.statusPage === 'public'`. Page response includes `Cache-Control: public, max-age=60`.
- [ ] **B.7.3** `/status/<slug>` for a public service renders correctly. For a private service → 404.
- [ ] **B.7.4** Create a status token via `/admin/tokens` → copy URL → open in **incognito**: tokenized page renders, response includes `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private`.
- [ ] **B.7.5** Revoke the token → opening the URL → 404.
- [ ] **B.7.6** Inspect the page source: confirm none of these fields appear: `privateMessage`, `rootCause`, `notes`, `secretRefIds`, `automation`, `access`.

### B.8 — Reporting (Phase 8)

- [ ] **B.8.1** Wait 24h after first deploy → check Firebase Functions logs at 00:05 UTC for `dailyRollup`. Confirm `services/{id}/daily/{YYYY-MM-DD}` docs exist.
- [ ] **B.8.2** From `/admin/reports/generate`, manually generate a report for the last 7 days → success toast → report visible in `/admin/reports/[id]`.
- [ ] **B.8.3** Toggle visibility on a report → `auditLog` entry written.
- [ ] **B.8.4** From `/admin/tokens` create a token with `reports` section allowed → tokenized page shows the latest report link.

### B.9 — Runbooks & tasks (Phase 9)

- [ ] **B.9.1** `/admin/runbooks/new` → create a runbook with steps, common failures, contacts.
- [ ] **B.9.2** `/admin/runbooks/[id]` renders the full runbook.
- [ ] **B.9.3** `/admin/runbooks/[id]/edit` → update → save.
- [ ] **B.9.4** Delete a runbook (confirm-gated).
- [ ] **B.9.5** `/admin/tasks` → create a task → state transitions todo → doing → done all work.
- [ ] **B.9.6** Inline notes on task detail page save and persist.

### B.10 — Internal checks (Phase 10)

- [ ] **B.10.1** Run `npm test -- tests/checks/internalChecks.test.ts` → 14 tests pass.
- [ ] **B.10.2** Create a monitor with `source: internal-http` and a known-good URL → wait ≤15 min → `monitors.lastResult === 'up'` and a new `uptimeSamples` doc with `expiresAt` set 30 days out.
- [ ] **B.10.3** Create a monitor with `source: internal-ssl` pointing to a valid HTTPS site → after one check, `daysToExpiry` is recorded on the sample.
- [ ] **B.10.4** Create a monitor with `source: internal-ssl` pointing to <https://expired.badssl.com> → `lastResult === 'down'`, an incident is opened, Telegram alert fires.
- [ ] **B.10.5** Create a monitor with `source: internal-domain` for one of your real domains → check the next run logs for a successful WHOIS lookup with `daysToExpiry`.
- [ ] **B.10.6** Create a monitor with `source: internal-dns` and `config.expectRecords: { A: ['1.2.3.4'] }` for a domain whose A record differs → `lastResult === 'down'`, incident opens.

### B.11 — Cross-cutting

- [ ] **B.11.1** **Weekly health check**: from Functions Console, run `weeklyHealthCheck` manually (Run Now). Confirm Telegram message arrives with 4 ✅ entries (UptimeRobot, Telegram, Resend, Firestore).
- [ ] **B.11.2** Verify all 5 scheduled functions show `maxInstances: 1` in Cloud Functions Console (Configuration tab).
- [ ] **B.11.3** **Cost guard**: in GCP → Billing → Budgets → set a monthly budget alert at €20 / €50 / €100 thresholds.
- [ ] **B.11.4** **Backups**: enable Firestore daily exports to a GCS bucket via `gcloud firestore export` cron (or use scheduled Cloud Scheduler).

### B.12 — Security smoke tests

- [ ] **B.12.1** Open `/admin/clients` while logged out → 302 to `/login`.
- [ ] **B.12.2** Hit `/api/incidents/<id>` (PATCH) without session cookie → 401.
- [ ] **B.12.3** Hit `/api/onboarding/submit` without session → 401.
- [ ] **B.12.4** Inspect Vercel build logs → no warnings about `firebase-admin` being bundled into client chunks.
- [ ] **B.12.5** Open `/status` in incognito → page loads without ever exposing the JS Firebase API key in a privileged way (it's a public key, but App Check should reject calls without a token).
- [ ] **B.12.6** Run `git status` after a local dev session → confirm no `*.json` service account files or `.env.local` show up as untracked.
- [ ] **B.12.7** **Firestore rules**: from Firebase Console → Firestore → Rules → Playground → simulate a read of `incidents/anyid` as `auth=null` → denied.

---

## Part C — Known limitations / deferred items

- ❌ **Phase 11** (auto-healing agent) is intentionally not built. Revisit after ≥3 months of operational history.
- ⚠️ **PDF / email delivery of reports** is not implemented (deferred). Reports are HTML-only.
- ⚠️ **Rate limiting** on webhook routes is absent in MVP. Cloudflare or Vercel rules can mitigate if abuse is observed.
- ⚠️ **Secret rotation** is manual via `gcloud secrets versions add`. No scheduled rotation function.
- ⚠️ The `tokenUsageDedup` collection accumulates ~1 doc per active token per day. Low-cardinality, but consider adding a TTL field if you ever issue many short-lived tokens.

---

## Part D — Quick reference

| Item | Location |
|---|---|
| Set admin claim | `npm run set-admin -- <UID>` |
| Run all unit tests (no emulator) | `npm test -- tests/checks tests/incidents tests/status tests/webhooks` |
| Run rules tests (needs emulator) | `firebase emulators:exec --only firestore "npm test -- tests/rules.test.ts"` |
| Type-check root | `npm run typecheck` |
| Type-check functions | `cd functions && npm run typecheck` |
| Deploy rules+indexes | `firebase deploy --only firestore` |
| Deploy functions | `firebase deploy --only functions` |
| Deploy site | `git push` (Vercel auto-builds) |
