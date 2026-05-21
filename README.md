# Command Center — Alessio Bernardini

Private operational dashboard for managing clients, services, infrastructure, monitoring, incidents, and reports.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, App Check, Secret Manager)
- **Hosting**: Vercel (Next.js app), Firebase (Functions)
- **Monitoring**: Custom internal checks (HTTP + SSL)
- **Alerts**: Telegram

---

## Local Development Setup

### 1. Prerequisites

```bash
node -v   # 22+
npm -v    # 10+
firebase --version  # firebase-tools 13+
```

Install Firebase CLI if not present:
```bash
npm install -g firebase-tools
firebase login
```

### 2. Clone and install

```bash
git clone <repo>
cd korelab
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Firebase project config. You can find these values in the Firebase console under Project Settings → General → Your apps.

For `FIREBASE_ADMIN_SA_JSON`: go to Project Settings → Service accounts → Generate new private key. Paste the JSON content as a **single-line** string (remove newlines).

### 4. Start Firebase emulators

```bash
firebase emulators:start --only auth,firestore,functions
```

Emulator UI: http://localhost:4000

### 5. Set admin custom claim (one-time setup)

1. Sign up your admin account in the Firebase Auth UI (or via the emulator).
2. Copy your UID from Firebase Console → Authentication → Users.
3. With `FIREBASE_ADMIN_SA_JSON` set in `.env.local`, run:

```bash
npm run set-admin -- <YOUR_UID>
```

The script grants `role: 'admin'` as a custom claim. **You must sign out and back in** for the claim to appear in your ID token.

### 6. Start Next.js dev server

```bash
npm run dev
```

App: http://localhost:3000

---

## Project Structure

```
/                          # Next.js app root
  src/
    app/                   # App Router pages + API routes
      admin/               # 🔒 Admin pages (require auth + admin role)
      login/               # Login page
      status/              # Public status page (Phase 7)
      s/[token]/           # Tokenized status page (Phase 7)
      api/
        auth/session/      # Session cookie exchange
    lib/
      firebase/            # Firebase client + admin singletons, App Check
      auth/                # Session management + requireAdmin guard
    components/
      layout/              # AdminShell, Sidebar, Topbar
      auth/                # LoginForm, MfaEnrollPrompt
  middleware.ts            # /admin/* route protection
/functions/                # Cloud Functions (separate package)
  src/
    index.ts               # Function exports (populated per phase)
/firestore.rules           # Firestore security rules
/firestore.indexes.json    # Composite indexes
/firebase.json             # Firebase project config
```

---

## Authentication Flow

1. User visits `/admin/*` → middleware checks for `__session` cookie.
2. If missing → redirect to `/login`.
3. User submits email + password → Firebase Auth SDK.
4. If MFA required → TOTP challenge via `LoginForm`.
5. On success → `POST /api/auth/session` with Firebase ID token.
6. Server creates a session cookie (HttpOnly, Secure, SameSite=Lax, 5 days).
7. Every admin page/layout calls `requireAdmin()` which:
   - Reads the `__session` cookie.
   - Verifies it cryptographically via Firebase Admin SDK.
   - Checks `role === 'admin'` custom claim.
   - If invalid → redirects to `/login`.

---

## Firestore TTL Notes

The following collections have TTL enabled. Set the TTL policy in the Firebase console (or via terraform) after first deploy:

| Collection         | Field      | TTL     |
|--------------------|------------|---------|
| `alertDedup`       | expiresAt  | 1 hour  |

Navigate to: Firebase Console → Firestore → Indexes → TTL policies.

---

## Deploy

```bash
# Deploy Next.js to Vercel
vercel --prod

# Deploy Firestore rules + indexes
firebase deploy --only firestore

# Deploy Cloud Functions
firebase deploy --only functions
```

Deployed Cloud Functions:

| Function | Trigger | Schedule |
|---|---|---|
| `onIncidentWrite` | Firestore `incidents/{id}` write | — |
| `resolveStableUp` | Scheduler | every 1 minute |
| `dailyRollup` | Scheduler | 00:05 UTC daily |
| `generateMonthlyReports` | Scheduler | 01:00 UTC 1st of month |
| `internalChecks` | Scheduler | every 15 minutes |
| `weeklyHealthCheck` | Scheduler | Monday 08:00 UTC |

Set the following environment variables in Vercel:
- `NEXT_PUBLIC_FIREBASE_*` — from Firebase project settings
- `FIREBASE_ADMIN_SA_JSON` — service account JSON as a single-line string
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — from Google reCAPTCHA console

Required Google Secret Manager secrets (in the Firebase project):

| Secret name | Used by |
|---|---|
| `telegram-bot-token` | `onIncidentWrite`, `internalChecks`, `weeklyHealthCheck` |

Cloud Function environment variables (set via `firebase functions:config` or `.env` in `functions/`):

| Var | Description |
|---|---|
| `ADMIN_TELEGRAM_CHAT_ID` | Your personal Telegram chat ID for admin alerts |

---

## Implementation Phases

See `COMMAND_CENTER_ARCHITECTURE.md` for the full architecture document and phase-by-phase implementation plan.

| Phase | Status | Description |
|-------|--------|-------------|
| 1  | ✅ Done | Project setup, Auth, Base layout |
| 2  | ✅ Done | Firestore schema, rules, typed repos |
| 3  | ✅ Done | Onboarding wizard |
| 5  | ✅ Done | Incident management |
| 6  | ✅ Done | Private dashboard |
| 10 | ✅ Done | Internal checks (SSL, DNS, domain, HTTP) |
| 7  | ✅ Done | Public & tokenized status pages |
| 8  | ✅ Done | Reporting & token management |
| 9  | ✅ Done | Runbooks & tasks |
| CC | ✅ Done | Weekly integration health check + maxInstances |
| 11 | ⬜ Deferred | Auto-healing agent (after ≥3 months incident history) |
