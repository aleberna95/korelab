import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdmin } from '@/lib/auth/guards'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLogRepo } from '@/lib/repos/auditLogRepo'

// ─── Request schema ────────────────────────────────────────────────────────

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().min(1),
  primary: z.boolean(),
})

const ClientInputSchema = z.object({
  name: z.string().min(1),
  businessType: z.enum(['agency', 'ecommerce', 'corporate', 'startup', 'other']),
  contacts: z.array(ContactSchema).min(1),
  notificationPrefs: z.object({
    email: z.boolean(),
    emails: z.array(z.string().email()),
    telegramChatId: z.string().optional(),
  }),
  supportPlan: z.enum([
    'none',
    'monitor-only',
    'reporting-only',
    'managed-support',
    'managed-infra',
    'auto-healing',
  ]),
  consent: z.object({
    monitoring: z.boolean(),
    notification: z.boolean(),
    intervention: z.boolean(),
    autoHealing: z.boolean(),
  }),
  contractUrl: z.string().optional(),
  tags: z.array(z.string()),
  notes: z.string(),
  status: z.literal('active'),
})

const ServiceInputSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  environment: z.enum(['production', 'staging', 'dev']),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()),
  description: z.string(),
  urls: z
    .object({
      primary: z.string().optional(),
      admin: z.string().optional(),
      healthcheck: z.string().optional(),
      docs: z.string().optional(),
    })
    .optional(),
  access: z.object({
    level: z.enum(['none', 'read-only', 'operational', 'admin']),
    providers: z.array(z.string()),
    notes: z.string(),
  }),
  visibility: z.object({
    statusPage: z.enum(['private', 'tokenized', 'public']),
    reportSharing: z.enum(['private', 'tokenized', 'email']),
  }),
})

const MonitorInputSchema = z.object({
  source: z.enum([
    'uptimerobot',
    'internal-http',
    'internal-ssl',
    'internal-dns',
    'internal-domain',
  ]),
  config: z.object({
    intervalSec: z.number().min(30).max(3600),
    url: z.string().optional(),
    expectStatus: z.number().min(100).max(599),
    expectBody: z.string().optional(),
  }),
  alertChannels: z.object({
    telegram: z.boolean(),
    email: z.boolean(),
    clientNotify: z.boolean(),
  }),
  active: z.boolean(),
})

const ResourceInputSchema = z.object({
  kind: z.string().min(1),
  name: z.string().min(1),
  metadata: z.record(z.unknown()),
  tags: z.array(z.string()),
  secretRefIds: z.array(z.string()),
})

const RunbookInputSchema = z.object({
  title: z.string().min(1),
  serviceTypes: z.array(z.string()),
  appliesToTags: z.array(z.string()),
  firstChecks: z.array(z.string()),
  contacts: z.array(z.string()),
  commonFailures: z.array(
    z.object({
      symptom: z.string(),
      likelyCause: z.string(),
      fix: z.string(),
    }),
  ),
  recoverySteps: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      riskLevel: z.enum(['low', 'medium', 'high']),
    }),
  ),
  links: z.array(z.string()),
  notes: z.string(),
})

const OnboardingPayloadSchema = z.object({
  clientMode: z.enum(['new', 'existing']),
  existingClientId: z.string().optional(),
  existingClientSupportPlan: z.string().optional(),
  client: ClientInputSchema.optional(),
  service: ServiceInputSchema,
  monitor: MonitorInputSchema.optional(),
  secretManagerRefs: z.array(z.string()),
  resources: z.array(ResourceInputSchema),
  runbookMode: z.enum(['none', 'existing', 'new']),
  existingRunbookId: z.string().optional(),
  runbook: RunbookInputSchema.optional(),
})

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  let session: { uid: string }
  try {
    session = await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = OnboardingPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const payload = parsed.data

  // Validate cross-field consistency
  if (payload.clientMode === 'new' && !payload.client) {
    return NextResponse.json(
      { ok: false, error: 'client data required when clientMode is "new"' },
      { status: 422 },
    )
  }
  if (payload.clientMode === 'existing' && !payload.existingClientId) {
    return NextResponse.json(
      { ok: false, error: 'existingClientId required when clientMode is "existing"' },
      { status: 422 },
    )
  }

  // 3. Pre-generate document IDs (safe — no writes yet)
  const db = getAdminDb()
  const now = FieldValue.serverTimestamp()

  const clientRef =
    payload.clientMode === 'new'
      ? db.collection('clients').doc()
      : db.collection('clients').doc(payload.existingClientId!)

  const serviceRef = db.collection('services').doc()
  const monitorRef = payload.monitor ? db.collection('monitors').doc() : null

  const resourceRefs = payload.resources.map(() => db.collection('resources').doc())

  let runbookRef: FirebaseFirestore.DocumentReference | null = null
  if (payload.runbookMode === 'new' && payload.runbook) {
    runbookRef = db.collection('runbooks').doc()
  } else if (payload.runbookMode === 'existing' && payload.existingRunbookId) {
    runbookRef = db.collection('runbooks').doc(payload.existingRunbookId)
  }

  const clientId = clientRef.id

  // 4. Atomic transaction
  try {
    await db.runTransaction(async (tx) => {
      // 4a. Create client if new
      if (payload.clientMode === 'new' && payload.client) {
        tx.set(clientRef, {
          ...payload.client,
          id: clientRef.id,
          createdAt: now,
          updatedAt: now,
        })
      }

      // 4b. Create service
      tx.set(serviceRef, {
        ...payload.service,
        id: serviceRef.id,
        clientId,
        monitorIds: monitorRef ? [monitorRef.id] : [],
        resourceIds: resourceRefs.map((r) => r.id),
        runbookIds:
          runbookRef && payload.runbookMode !== 'none' ? [runbookRef.id] : [],
        // Enforce safe defaults
        automation: {
          mode: 'disabled',
          allowedActions: [],
          cooldownMinutes: 30,
          maxRetries: 3,
        },
        currentStatus: {
          state: 'unknown',
          since: now,
        },
        createdAt: now,
        updatedAt: now,
      })

      // 4c. Create monitor
      if (monitorRef && payload.monitor) {
        tx.set(monitorRef, {
          ...payload.monitor,
          id: monitorRef.id,
          serviceId: serviceRef.id,
          clientId,
          createdAt: now,
          updatedAt: now,
        })
      }

      // 4d. Create runbook if new
      if (runbookRef && payload.runbookMode === 'new' && payload.runbook) {
        tx.set(runbookRef, {
          ...payload.runbook,
          id: runbookRef.id,
          createdAt: now,
          updatedAt: now,
        })
      }

      // 4e. Create resources
      payload.resources.forEach((resource, i) => {
        tx.set(resourceRefs[i], {
          ...resource,
          id: resourceRefs[i].id,
          clientId,
          createdAt: now,
          updatedAt: now,
        })
      })
    })
  } catch (err) {
    console.error('[onboarding] transaction failed', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to save — transaction rolled back.' },
      { status: 500 },
    )
  }

  // 5. Audit log (outside transaction — Admin SDK bypasses rules)
  await auditLogRepo.write({
    actorUid: session.uid,
    actorKind: 'user',
    action: 'onboarding.create',
    targetCollection: 'services',
    targetId: serviceRef.id,
    metadata: {
      clientId,
      serviceId: serviceRef.id,
      monitorId: monitorRef?.id ?? null,
      runbookId: runbookRef?.id ?? null,
      resourceIds: resourceRefs.map((r) => r.id),
    },
  })

  // 6. Clear sessionStorage hint (client handles this on success redirect)
  return NextResponse.json({
    ok: true,
    ids: {
      clientId,
      serviceId: serviceRef.id,
      monitorId: monitorRef?.id,
      runbookId: runbookRef?.id,
      resourceIds: resourceRefs.map((r) => r.id),
    },
  })
}
