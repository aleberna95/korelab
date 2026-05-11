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
  alertChannels: { telegram: true, clientNotify: false },
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
