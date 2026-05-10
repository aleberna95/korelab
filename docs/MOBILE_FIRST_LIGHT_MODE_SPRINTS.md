# Refactoring: Mobile-First + Light Mode

> Piano sprint per trasformare il gestionale KoreLab Command Center in un'app **mobile-first** con **light mode** coerente.

---

## Stato attuale (audit)

| Area | Tema | Mobile-ready |
|------|------|-------------|
| Layout shell (Sidebar, Topbar, AdminShell) | Dark (zinc-950/900) | ❌ Sidebar fissa w-60 |
| Overview, Services, Clients, Incidents | Light (bg-white, gray-*) | Parziale |
| Reports, Runbooks, Tasks, Tokens | Dark (zinc-800/700) | Parziale |
| Settings, Maintenance, Monitors | Light (gray-*) | ❌ Solo container |
| Onboarding wizard (8 step) | Dark (zinc-800) | ❌ Sidebar fissa w-52 |
| Login | Dark (zinc-800) | ❌ |
| Status page pubblica | Dark (zinc-900) | Parziale |
| globals.css | Dark (#0a0a0a) | — |

**Problemi principali:**
- Mix dark/light incoerente tra le pagine
- Sidebar non collassabile su mobile
- Nessun hamburger menu
- Onboarding wizard con layout a 2 colonne fisse
- Tabelle non responsive (overflow nascosto)
- Form `grid-cols-2/3` che non collassano su mobile
- Bottoni primari inconsistenti (blue-600 vs indigo-600)
- Container max-width variabili (2xl–5xl)
- Input class duplicata in ogni file

---

## Convenzioni da seguire

- **Tailwind v4** (già installato, no config file)
- **Mobile-first**: stili base = mobile, poi `sm:`, `md:`, `lg:`
- **Nessuna libreria UI esterna** — tutto custom con Tailwind
- **CSS variables in globals.css** per i design token
- **Nessun dark mode** — solo light mode coerente
- **Touch target minimo**: 44×44px per bottoni e link interattivi
- **Container standard**: `max-w-6xl mx-auto px-4 sm:px-6`

---

## Sprint 0 — Design Token & globals.css

**Obiettivo**: Definire i token di design light mode in `globals.css` e rimuovere `className="dark"` dal root layout.

**File da modificare:**
- `src/app/globals.css`
- `src/app/layout.tsx`

**Azioni:**
1. Sostituire le CSS variables in `:root` con palette light mode:
   ```css
   :root {
     --background: #ffffff;
     --foreground: #111827;       /* gray-900 */
     --muted: #f9fafb;            /* gray-50 */
     --muted-foreground: #6b7280; /* gray-500 */
     --border: #e5e7eb;           /* gray-200 */
     --ring: #3b82f6;             /* blue-500 */
     --accent: #3b82f6;           /* blue-500 */
     --accent-hover: #2563eb;     /* blue-600 */
     --destructive: #ef4444;      /* red-500 */
     --success: #22c55e;          /* green-500 */
     --warning: #f59e0b;          /* amber-500 */
     --sidebar-bg: #ffffff;
     --sidebar-border: #e5e7eb;
     --sidebar-active: #eff6ff;   /* blue-50 */
     --sidebar-active-text: #1d4ed8; /* blue-700 */
     --topbar-bg: #ffffff;
     --topbar-border: #e5e7eb;
   }
   ```
2. Aggiornare `body` per usare i nuovi token
3. In `layout.tsx`: rimuovere `className="dark"` da `<html>`, assicurarsi che `<body>` usi `bg-white text-gray-900`
4. Aggiungere utility classes globali per input e bottoni (opzionale, con `@layer components`):
   ```css
   @layer components {
     .input-base {
       @apply w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
              text-gray-900 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
     }
     .btn-primary {
       @apply rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed;
     }
     .btn-secondary {
       @apply rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium
              text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500;
     }
     .btn-danger {
       @apply rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500;
     }
   }
   ```

**Verifica**: L'app si carica con sfondo bianco, nessun flash di dark mode.

---

## Sprint 1 — Layout Shell mobile-first

**Obiettivo**: Rendere AdminShell, Sidebar e Topbar responsive con hamburger menu e light mode.

**File da modificare:**
- `src/components/layout/AdminShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`

**Azioni:**

### AdminShell.tsx
1. Rimuovere `bg-zinc-950 text-white`
2. Usare `bg-gray-50 text-gray-900` come contenitore
3. Layout mobile-first:
   ```
   Mobile: sidebar nascosta (off-canvas overlay)
   md+: sidebar visibile fissa a sinistra
   ```
4. Aggiungere stato `sidebarOpen` con React useState
5. Main content: `p-4 sm:p-6` (padding più compatto su mobile)

### Sidebar.tsx
1. Convertire a light mode:
   - Background: `bg-white border-r border-gray-200`
   - Link attivo: `bg-blue-50 text-blue-700 font-medium`
   - Link hover: `hover:bg-gray-100 text-gray-700`
   - Link default: `text-gray-600`
2. Mobile: overlay full-height con backdrop `bg-black/20`
   - `fixed inset-y-0 left-0 z-40 w-64 transform transition-transform`
   - Default: `-translate-x-full` / Aperta: `translate-x-0`
   - `md:static md:translate-x-0 md:w-60`
3. Aggiungere bottone chiudi (X) visibile solo su mobile
4. Aggiungere logo/brand in cima alla sidebar

### Topbar.tsx
1. Convertire a light mode:
   - `bg-white border-b border-gray-200`
   - Testo: `text-gray-900`
2. Aggiungere hamburger button (☰) visibile solo su `md:hidden`
3. Il pulsante hamburger invoca `onToggleSidebar` callback
4. Logout button: stile secondario light

**Verifica**: Su viewport < 768px la sidebar è nascosta, si apre con hamburger, si chiude con tap su backdrop o X. Su desktop sidebar fissa a sinistra.

---

## Sprint 2 — Pagine admin light mode (batch 1: già quasi light)

**Obiettivo**: Normalizzare le pagine che sono già in light mode, correggendo inconsistenze e aggiungendo responsive.

**File da modificare:**
- `src/app/admin/page.tsx` (Overview)
- `src/app/admin/services/page.tsx`
- `src/app/admin/services/[id]/page.tsx`
- `src/app/admin/clients/page.tsx`
- `src/app/admin/incidents/page.tsx`
- `src/app/admin/incidents/[id]/page.tsx`
- `src/app/admin/clients/[id]/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/maintenance/page.tsx`
- `src/app/admin/monitors/page.tsx`
- `src/app/admin/audit/page.tsx`

**Azioni per ogni pagina:**
1. Container: uniformare a `max-w-6xl mx-auto px-4 sm:px-6 space-y-6`
2. Titoli: `text-xl sm:text-2xl font-bold text-gray-900`
3. Tabelle: wrappare in `overflow-x-auto -mx-4 sm:mx-0` e aggiungere `min-w-[600px]` alla table
4. Card/KPI grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
5. Verificare che tutti i colori siano dalla palette gray/blue (no zinc)
6. Bottoni: usare le classi `btn-primary`, `btn-secondary` definite nello Sprint 0
7. Input/select: usare `input-base`
8. Badge di stato: assicurarsi che usino i colori standard (StatusBadge.tsx)
9. Link: `text-blue-600 hover:text-blue-800 hover:underline`

**Componenti da aggiornare:**
- `src/components/dashboard/KpiCard.tsx` — verificare padding touch-friendly
- `src/components/dashboard/ServiceTable.tsx` — aggiungere responsive wrapper
- `src/components/dashboard/FilterBar.tsx` — stack verticale su mobile (`flex flex-col sm:flex-row`)
- `src/components/dashboard/StatusBadge.tsx` — OK, solo verificare
- `src/components/dashboard/DependencyGraph.tsx` — aggiungere `overflow-x-auto`
- `src/components/incidents/IncidentList.tsx` — responsive cards o tabella scrollabile
- `src/components/incidents/IncidentDetail.tsx` — `grid-cols-1` base, `lg:grid-cols-3` desktop
- `src/components/incidents/IncidentEditor.tsx` — `grid-cols-1 sm:grid-cols-2` per i form
- `src/components/incidents/IncidentTimeline.tsx` — OK, già lineare

**Pagina client detail (`clients/[id]/page.tsx`):**
- Ha già responsive `grid-cols-1 lg:grid-cols-3`, normalizzare container e verificare palette

**Verifica**: Tutte le pagine sopra usano palette light coerente e sono usabili su mobile 375px.

---

## Sprint 3 — Pagine admin light mode (batch 2: da dark a light)

**Obiettivo**: Convertire le pagine attualmente dark a light mode + mobile-first.

**File da modificare:**
- `src/app/admin/reports/page.tsx`
- `src/app/admin/reports/generate/page.tsx`
- `src/app/admin/reports/generate/GenerateReportForm.tsx`
- `src/app/admin/reports/[id]/page.tsx`
- `src/app/admin/reports/[id]/ReportVisibilityForm.tsx`
- `src/app/admin/runbooks/page.tsx`
- `src/app/admin/runbooks/new/page.tsx`
- `src/app/admin/runbooks/RunbookForm.tsx`
- `src/app/admin/runbooks/[id]/page.tsx`
- `src/app/admin/runbooks/[id]/edit/page.tsx`
- `src/app/admin/runbooks/[id]/edit/DeleteRunbookButton.tsx`
- `src/app/admin/tasks/page.tsx`
- `src/app/admin/tasks/CreateTaskForm.tsx`
- `src/app/admin/tasks/[id]/page.tsx`
- `src/app/admin/tasks/[id]/TaskStateButtons.tsx`
- `src/app/admin/tasks/[id]/TaskNoteForm.tsx`
- `src/app/admin/tokens/page.tsx`
- `src/app/admin/tokens/CreateTokenForm.tsx`
- `src/app/admin/tokens/RevokeTokenButton.tsx`

**Azioni per ogni file:**
1. Sostituire tutti i colori `zinc-*` con equivalenti `gray-*` / `white`:
   - `bg-zinc-800` → `bg-white border border-gray-200`
   - `bg-zinc-800/60` → `bg-gray-50`
   - `bg-zinc-900` → `bg-white`
   - `bg-zinc-700` → `bg-gray-100`
   - `text-white` → `text-gray-900`
   - `text-zinc-400` → `text-gray-500`
   - `text-zinc-300` → `text-gray-600`
   - `border-zinc-700` → `border-gray-200`
   - `border-zinc-600` → `border-gray-300`
   - `hover:bg-zinc-700` → `hover:bg-gray-100`
2. Container: uniformare a `max-w-6xl mx-auto px-4 sm:px-6 space-y-6`
3. Grid form: `grid-cols-1 sm:grid-cols-2` (collassare su mobile)
4. Badge dark (es. `bg-blue-900 text-blue-300`) → light (`bg-blue-100 text-blue-800`)
5. Bottoni: standardizzare con classi Sprint 0
6. Input: standardizzare con `input-base`
7. Task state buttons: adattare colori a light (`bg-blue-100 text-blue-700`, ecc.)
8. TaskNoteForm: input e bottone light, stessi stili `input-base` + `btn-primary`
9. ReportVisibilityForm: select e bottone light
10. DeleteRunbookButton: `btn-danger`
11. RevokeTokenButton: `btn-danger` o `btn-secondary` con conferma

**Regola per i badge di stato (standardizzare ovunque):**
```
operational:  bg-green-100 text-green-800
degraded:     bg-amber-100 text-amber-800
partial:      bg-orange-100 text-orange-800
major:        bg-red-100 text-red-800
maintenance:  bg-blue-100 text-blue-800
unknown:      bg-gray-100 text-gray-600
```

**Verifica**: Nessuna classe `zinc-*` rimasta in `src/app/admin/`. Tutte le pagine coerenti visivamente.

---

## Sprint 4 — Onboarding Wizard mobile-first

**Obiettivo**: Rendere il wizard di onboarding (8 step) completamente responsive e light mode.

**File da modificare:**
- `src/components/onboarding/WizardShell.tsx`
- `src/components/onboarding/StepNav.tsx`
- `src/components/onboarding/StepServiceBasics.tsx`
- `src/components/onboarding/StepClient.tsx`
- `src/components/onboarding/StepMonitoring.tsx`
- `src/components/onboarding/StepRunbook.tsx`
- `src/components/onboarding/StepReview.tsx`
- `src/components/onboarding/StepVisibility.tsx`
- `src/components/onboarding/StepAccess.tsx`
- `src/components/onboarding/StepAutomation.tsx`
- `src/components/onboarding/StepResources.tsx`
- `src/app/admin/onboarding/page.tsx`

**Azioni:**

### WizardShell.tsx
1. Convertire layout da `flex gap-6` (side-by-side fisso) a:
   - Mobile: navigazione step orizzontale in alto (progress dots/pills), contenuto sotto
   - `md+`: layout a 2 colonne come adesso ma con light mode
2. Rimuovere `w-52 shrink-0` dalla sidebar nav
3. Light mode: `bg-white rounded-xl border border-gray-200 shadow-sm`
4. Footer buttons: `flex flex-col sm:flex-row gap-2` (stack su mobile)

### StepNav.tsx
1. Mobile: `flex overflow-x-auto gap-2 pb-2` (pills orizzontali scrollabili)
2. Desktop (`md+`): colonna verticale come adesso
3. Light mode: step attivo `bg-blue-100 text-blue-700`, completato `text-green-600`, pending `text-gray-400`

### admin/onboarding/page.tsx
1. Pagina wrapper che monta il WizardShell — convertire `text-white` → `text-gray-900`
2. Verificare che non abbia background dark inline

### admin/onboarding/page.tsx
1. Pagina wrapper che monta il WizardShell — convertire `text-white` → `text-gray-900`
2. Verificare che non abbia background dark inline

### Tutti gli Step (StepServiceBasics, StepClient, ecc.)
1. Tutti i `bg-zinc-800` → `bg-white` o `bg-gray-50`
2. Tutti i `border-zinc-700` → `border-gray-200`
3. Tutti i `text-white/zinc-*` → `text-gray-900/500`
4. Grid: `grid-cols-1 sm:grid-cols-2` (tutti i form collassano su mobile)
5. Input: usare `input-base` definita nello Sprint 0
6. Focus ring: `focus:ring-blue-500` (uniformare da indigo a blue)
7. Bottoni aggiungi/rimuovi: touch target ≥ 44px

### StepReview.tsx
1. `grid-cols-[160px_1fr]` → mobile: lista verticale label sopra, valore sotto
2. `sm:grid-cols-[160px_1fr]` per desktop

**Verifica**: Wizard usabile su iPhone SE (375px). Step nav scrollabile. Form compilabili con thumb.

---

## Sprint 5 — Login & Status Page

**Obiettivo**: Convertire login e status page pubblica a light mode + mobile-first.

**File da modificare:**
- `src/app/login/page.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/MfaEnrollPrompt.tsx`
- `src/app/status/page.tsx`
- `src/app/status/[slug]/page.tsx`
- `src/app/s/[token]/page.tsx`
- `src/components/status/ServiceCard.tsx`
- `src/components/status/StatusHeader.tsx`
- `src/components/status/UptimeBar.tsx`
- `src/components/status/IncidentList.tsx`
- `src/components/status/MaintenanceList.tsx`

**Azioni:**

### Login
1. Background: `bg-gray-50` (full page)
2. Card: `bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8`
3. `max-w-sm mx-auto mt-20 sm:mt-32` (centrato, meno margine su mobile)
4. Input: `input-base`
5. Bottone login: `btn-primary w-full`
6. MFA step: stessi stili light

### Status Page (pubblica)
1. Background: `bg-white` o `bg-gray-50` (non zinc-950)
2. ServiceCard: `bg-white border border-gray-200 rounded-lg p-4`
3. StatusHeader: testo scuro, dot colorato per stato
4. UptimeBar: mantenere colori semantici (green/amber/red) su sfondo chiaro
5. Grid servizi: `grid-cols-1 sm:grid-cols-2` (stack su mobile)
6. Layout: `max-w-4xl mx-auto px-4 py-8`
7. `IncidentList.tsx` (status): convertire da dark a light — `bg-zinc-*` → `bg-white/gray-50`, testo `text-gray-900`
8. `status/[slug]/page.tsx` e `s/[token]/page.tsx`: stessa conversione dark → light di `status/page.tsx`

**Verifica**: Login e status page visivamente coerenti con il resto dell'app. Entrambe usabili su mobile.

---

## Sprint 6 — Polish & QA

**Obiettivo**: Pulizia finale, consistenza, accessibilità base, e test visivo.

**Azioni:**
1. **Grep globale**: cercare classi rimaste `zinc-`, `bg-zinc`, `text-zinc`, `border-zinc` in `src/` e rimuoverle
2. **Grep globale**: cercare `indigo-` in `src/` e sostituire con `blue-` per coerenza
3. **Grep globale**: cercare `className="dark"` e rimuovere
4. **Verificare** che tutte le tabelle abbiano `overflow-x-auto` wrapper
5. **Verificare** touch target: tutti i bottoni e link cliccabili ≥ 44×44px (`min-h-[44px] min-w-[44px]`)
6. **Verificare** focus visible: tutti gli elementi interattivi hanno `focus:ring-2 focus:ring-blue-500`
7. **Verificare** contrast ratio: testo grigio su bianco ≥ 4.5:1 (gray-600+ su white è OK)
8. **Rimuovere** variabili CSS inutilizzate da globals.css
9. **Responsive QA**: testare ogni pagina a 375px, 768px, 1280px
10. **Aggiungere** meta viewport se mancante (dovrebbe esserci da Next.js)

**Checklist viewport 375px:**
- [ ] Sidebar chiusa di default, apribile con hamburger
- [ ] Tutti i form single-column
- [ ] Tabelle scrollabili orizzontalmente
- [ ] Nessun overflow orizzontale sulla pagina
- [ ] Touch target adeguati
- [ ] Testo leggibile senza zoom

---

## Riepilogo sprint

| Sprint | Scope | File stimati | Dipende da |
|--------|-------|-------------|------------|
| 0 | Design token + globals | 2 | — |
| 1 | Layout shell responsive | 3 | Sprint 0 |
| 2 | Admin pages light (già quasi light) | ~15 | Sprint 0 |
| 3 | Admin pages dark → light | ~20 | Sprint 0 |
| 4 | Onboarding wizard | 12 | Sprint 0, 1 |
| 5 | Login + Status page | ~12 | Sprint 0 |
| 6 | Polish & QA | tutti | Sprint 1–5 |

**Ordine consigliato**: 0 → 1 → 2 → 3 → 4 → 5 → 6

Sprint 2 e 3 sono indipendenti tra loro e possono essere parallelizzati.
Sprint 4 e 5 sono indipendenti tra loro e possono essere parallelizzati.

---

## Note per Sonnet

- **Non aggiungere librerie UI** — tutto è Tailwind utility puro
- **Non creare componenti wrapper** generici inutili — mantieni lo stile attuale inline
- **Eccezione**: le classi `input-base`, `btn-primary`, `btn-secondary`, `btn-danger` nello Sprint 0 sono OK perché riducono duplicazione massiccia
- **Ogni sprint è autocontenuto**: alla fine di ogni sprint l'app deve compilare e funzionare
- **Non toccare logica business**: solo styling e layout. Nessuna modifica a fetch, state management, API calls
- **Testare** con `npm run build` alla fine di ogni sprint per verificare che non ci siano errori TypeScript
- **Non modificare** file in `functions/`, `tests/`, `scripts/`
