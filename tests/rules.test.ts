/**
 * Firestore Security Rules Tests
 *
 * Run with:
 *   firebase emulators:start --only firestore
 *   npx vitest run tests/rules.test.ts
 *
 * Requires FIRESTORE_EMULATOR_HOST env var (set automatically by firebase emulators).
 * Or start emulators in CI: firebase emulators:exec --only firestore "npx vitest run tests/rules.test.ts"
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'korelab-cc-test'
const RULES_PATH = resolve(__dirname, '../firestore.rules')

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// ─── Helper factories ────────────────────────────────────────────────────────

/** Authenticated admin user with role claim + fake App Check token */
function adminCtx() {
  return testEnv.authenticatedContext('admin-uid', {
    role: 'admin',
    // @firebase/rules-unit-testing auto-populates request.app for authenticated contexts
  })
}

/** Authenticated non-admin user */
function userCtx(uid = 'user-uid') {
  return testEnv.authenticatedContext(uid)
}

/** Unauthenticated context */
function anonCtx() {
  return testEnv.unauthenticatedContext()
}

const validClient = {
  name: 'ACME Corp',
  businessType: 'corporate',
  contacts: [],
  telegramChatId: '',
  supportPlan: 'monitor-only',
  consent: { monitoring: true, notification: true },
  tags: [],
  status: 'active',
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validService = {
  clientId: 'client-1',
  name: 'Main Website',
  type: 'static-site',
  environment: 'production',
  criticality: 'high',
  tags: [],
  description: '',
  url: 'https://example.com',
  statusPageVisibility: 'private',
  currentStatus: { state: 'unknown', since: new Date() },
  monitorIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validMonitor = {
  serviceId: 'svc-1',
  clientId: 'client-1',
  source: 'internal-http',
  config: { intervalSec: 60 },
  alertChannels: { telegram: true },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validIncident = {
  serviceId: 'svc-1',
  clientId: 'client-1',
  state: 'investigating',
  severity: 'minor',
  source: 'manual',
  title: 'Test incident',
  notifiedClient: false,
  metrics: {},
  startedAt: new Date(),
}

// ─── auditLog ────────────────────────────────────────────────────────────────

describe('auditLog', () => {
  it('admin can read audit log', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('auditLog').get())
  })

  it('admin cannot write to audit log (client SDK)', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('auditLog').add({ action: 'test', at: new Date() }))
  })

  it('anon cannot read audit log', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('auditLog').get())
  })
})

// ─── clients ─────────────────────────────────────────────────────────────────

describe('clients', () => {
  it('admin can read clients', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('clients').get())
  })

  it('admin can create a valid client', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('clients').add(validClient))
  })

  it('admin cannot create a client without required fields', async () => {
    const db = adminCtx().firestore()
    const invalid = { name: 'Missing Fields' }
    await assertFails(db.collection('clients').add(invalid))
  })

  it('admin cannot create a client with invalid status', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('clients').add({ ...validClient, status: 'unknown-status' }))
  })

  it('non-admin cannot read clients', async () => {
    const db = userCtx().firestore()
    await assertFails(db.collection('clients').get())
  })

  it('anon cannot read clients', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('clients').get())
  })
})

// ─── services ────────────────────────────────────────────────────────────────

describe('services', () => {
  it('admin can create a valid service', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('services').add(validService))
  })

  it('admin cannot create service with invalid criticality', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('services').add({ ...validService, criticality: 'ultra' }))
  })

  it('admin cannot create service with invalid environment', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('services').add({ ...validService, environment: 'qa' }))
  })

  it('non-admin cannot write services', async () => {
    const db = userCtx().firestore()
    await assertFails(db.collection('services').add(validService))
  })
})

// ─── monitors ────────────────────────────────────────────────────────────────

describe('monitors', () => {
  it('admin can create a valid monitor', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('monitors').add(validMonitor))
  })

  it('admin cannot create monitor with invalid source', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('monitors').add({ ...validMonitor, source: 'pingdom' }))
  })
})

// ─── incidents ───────────────────────────────────────────────────────────────

describe('incidents', () => {
  it('admin can create a valid incident', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('incidents').add(validIncident))
  })

  it('admin cannot create incident with invalid severity', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('incidents').add({ ...validIncident, severity: 'extreme' }))
  })
})

// ─── catch-all ───────────────────────────────────────────────────────────────

describe('catch-all deny', () => {
  it('admin cannot read unknown collection', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('unknownCollection').get())
  })

  it('anon cannot read anything', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('clients').get())
    await assertFails(db.collection('services').get())
    await assertFails(db.collection('auditLog').get())
  })
})

// ─── quotes ──────────────────────────────────────────────────────────────────

const validQuoteBozza = {
  number: 'PREV-2026-001',
  clientId: 'client-1',
  clientSnapshot: { name: 'ACME Corp' },
  status: 'bozza',
  lines: [],
  discounts: [],
  vatPercent: 5,
  payment: { mode: 'lump-sum' },
  totals: { subtotalCents: 0, discountTotalCents: 0, taxableCents: 0, vatCents: 0, totalCents: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('quotes', () => {
  it('admin can read quotes', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('quotes').get())
  })

  it('admin can create a bozza quote', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('quotes').add(validQuoteBozza))
  })

  it('admin cannot create a quote with status != bozza', async () => {
    const db = adminCtx().firestore()
    await assertFails(
      db.collection('quotes').add({ ...validQuoteBozza, status: 'in-approvazione' }),
    )
    await assertFails(
      db.collection('quotes').add({ ...validQuoteBozza, status: 'approvato' }),
    )
  })

  it('admin can update a bozza quote (not setting it to approvato)', async () => {
    const db = adminCtx().firestore()
    const ref = await db.collection('quotes').add(validQuoteBozza)
    await assertSucceeds(ref.update({ ...validQuoteBozza, status: 'in-approvazione', updatedAt: new Date() }))
  })

  it('admin cannot update a quote to approvato via client SDK', async () => {
    const db = adminCtx().firestore()
    const ref = await db.collection('quotes').add(validQuoteBozza)
    await assertFails(ref.update({ ...validQuoteBozza, status: 'approvato', updatedAt: new Date() }))
  })

  it('admin can delete a bozza quote', async () => {
    const db = adminCtx().firestore()
    const ref = await db.collection('quotes').add(validQuoteBozza)
    await assertSucceeds(ref.delete())
  })

  it('non-admin cannot read quotes', async () => {
    const db = userCtx().firestore()
    await assertFails(db.collection('quotes').get())
  })

  it('anon cannot read quotes', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('quotes').get())
  })
})

// ─── payments ────────────────────────────────────────────────────────────────

const validPayment = {
  number: 'PAG-2026-001',
  quoteId: 'quote-1',
  quoteNumber: 'PREV-2026-001',
  clientId: 'client-1',
  clientSnapshot: { name: 'ACME Corp' },
  totalCents: 100000,
  installments: [],
  status: 'open',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('payments', () => {
  it('admin can read payments', async () => {
    const db = adminCtx().firestore()
    await assertSucceeds(db.collection('payments').get())
  })

  it('admin cannot write payments via client SDK', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('payments').add(validPayment))
  })

  it('non-admin cannot read payments', async () => {
    const db = userCtx().firestore()
    await assertFails(db.collection('payments').get())
  })

  it('anon cannot write payments', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('payments').add(validPayment))
  })
})

// ─── counters ────────────────────────────────────────────────────────────────

describe('counters', () => {
  it('admin cannot read counters via client SDK', async () => {
    const db = adminCtx().firestore()
    await assertFails(db.collection('counters').doc('2026').get())
  })

  it('admin cannot write counters via client SDK', async () => {
    const db = adminCtx().firestore()
    await assertFails(
      db.collection('counters').doc('2026').set({ quoteSeq: 1, paymentSeq: 1 }),
    )
  })

  it('anon cannot access counters', async () => {
    const db = anonCtx().firestore()
    await assertFails(db.collection('counters').doc('2026').get())
  })
})
