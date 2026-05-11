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
  telegramChatId: z.string().optional(),
  supportPlan: z.enum(['monitor-only', 'managed', 'full']),
  consent: z.object({
    monitoring: z.boolean(),
    notification: z.boolean(),
  }),
  tags: z.array(z.string()),
  notes: z.string(),
  status: z.literal('active'),
})

const ServiceInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'static-site', 'landing', 'corporate-site', 'ecommerce', 'saas',
    'api', 'mobile-backend', 'firebase-project', 'domain', 'other',
  ]),
  environment: z.enum(['production', 'staging', 'dev']),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()),
  description: z.string(),
  url: z.string().optional(),
  healthcheckUrl: z.string().optional(),
  statusPageVisibility: z.enum(['private', 'tokenized', 'public']),
})

const MonitorInputSchema = z.object({
  source: z.enum(['internal-http', 'internal-ssl']),
  config: z.object({
    intervalSec: z.number().min(30).max(3600),
    url: z.string().optional(),
    expectStatus: z.number().min(100).max(599),
    expectBody: z.string().optional(),
  }),
  alertChannels: z.object({
    telegram: z.boolean(),
    clientNotify: z.boolean(),
  }),
  active: z.boolean(),
})

const OnboardingPayloadSchema = z.object({
  clientMode: z.enum(['new', 'existing']),
  existingClientId: z.string().optional(),
  client: ClientInputSchema.optional(),
  service: ServiceInputSchema,
  monitor: MonitorInputSchema,
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

  // 3. Pre-generate document IDs
  const db = getAdminDb()
  const now = FieldValue.serverTimestamp()

  const clientRef =
    payload.clientMode === 'new'
      ? db.collection('clients').doc()
      : db.collection('clients').doc(payload.existingClientId!)

  const serviceRef = db.collection('services').doc()
  const monitorRef = db.collection('monitors').doc()

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
        monitorIds: [monitorRef.id],
        currentStatus: {
          state: 'unknown',
          since: now,
        },
        createdAt: now,
        updatedAt: now,
      })

      // 4c. Create monitor
      tx.set(monitorRef, {
        ...payload.monitor,
        id: monitorRef.id,
        serviceId: serviceRef.id,
        clientId,
        createdAt: now,
        updatedAt: now,
      })
    })
  } catch (err) {
    console.error('[onboarding] transaction failed', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to save — transaction rolled back.' },
      { status: 500 },
    )
  }

  // 5. Audit log
  await auditLogRepo.write({
    actorUid: session.uid,
    actorKind: 'user',
    action: 'onboarding.create',
    targetCollection: 'services',
    targetId: serviceRef.id,
    metadata: {
      clientId,
      serviceId: serviceRef.id,
      monitorId: monitorRef.id,
    },
  })

  return NextResponse.json({
    ok: true,
    ids: {
      clientId,
      serviceId: serviceRef.id,
      monitorId: monitorRef.id,
    },
  })
}
