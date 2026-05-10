import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { lookupWebhookSecret } from '@/lib/webhooks/uptimerobot/verify'
import { normalizeUrPayload, type RawUrPayload } from '@/lib/webhooks/uptimerobot/normalize'
import { dispatchToIncidentEngine } from '@/lib/incidents/engine'

const MAX_BODY_BYTES = 16 * 1024 // 16 KB
const TTL_30_DAYS_MS = 30 * 24 * 60 * 60 * 1_000

type Params = { params: Promise<{ secret: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { secret } = await params

  // ── 1. Body size guard ──────────────────────────────────────────────────
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  // ── 2. Verify secret → resolve monitorId ────────────────────────────────
  const monitorId = await lookupWebhookSecret(secret)
  if (!monitorId) {
    // Return 404 so attackers can't enumerate valid secrets
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 3. Parse body (form-encoded or JSON) ────────────────────────────────
  let raw: RawUrPayload
  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      raw = await req.json()
    } else {
      // UptimeRobot sends application/x-www-form-urlencoded
      const text = await req.text()
      const params = new URLSearchParams(text)
      raw = Object.fromEntries(params.entries()) as unknown as RawUrPayload
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // ── 4. Normalize ─────────────────────────────────────────────────────────
  const event = normalizeUrPayload(raw)
  if (!event.externalMonitorId) {
    return NextResponse.json({ error: 'Missing monitorID in payload' }, { status: 422 })
  }

  // ── 5. Fetch monitor doc to get serviceId ────────────────────────────────
  const db = getAdminDb()
  const monitorSnap = await db.collection('monitors').doc(monitorId).get()
  if (!monitorSnap.exists) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }
  const monitorDoc = monitorSnap.data() as {
    serviceId: string
    externalId?: string
    lastResult?: string
    lastCheckAt?: FirebaseFirestore.Timestamp
  }
  const serviceId = monitorDoc.serviceId
  // Capture previous state before the batch updates it (used for engine debounce)
  const previousResult = monitorDoc.lastResult ?? null
  const previousCheckAt = monitorDoc.lastCheckAt?.toDate() ?? null

  // ── 6. Idempotency — dedup by (monitorId, externalEventId) ───────────────
  const dedupKey = `${monitorId}::${event.externalEventId}`
  const processedRef = db.collection('processedEvents').doc(dedupKey)

  let isDuplicate = false
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(processedRef)
    if (snap.exists) {
      isDuplicate = true
      return
    }
    tx.set(processedRef, {
      monitorId,
      serviceId,
      kind: event.kind,
      at: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + TTL_30_DAYS_MS),
    })
  })

  if (isDuplicate) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // ── 7. Persist webhookEvent and uptimeSample ─────────────────────────────
  const now = FieldValue.serverTimestamp()
  const expiresAt = new Date(Date.now() + TTL_30_DAYS_MS)

  const webhookRef = db.collection('webhookEvents').doc()
  const sampleRef = db.collection('uptimeSamples').doc()

  const batch = db.batch()

  batch.set(webhookRef, {
    id: webhookRef.id,
    monitorId,
    serviceId,
    source: 'uptimerobot',
    externalMonitorId: event.externalMonitorId,
    externalEventId: event.externalEventId,
    kind: event.kind,
    at: event.at,
    rawPayload: raw,
    receivedAt: now,
    expiresAt,
  })

  batch.set(sampleRef, {
    id: sampleRef.id,
    monitorId,
    serviceId,
    kind: event.kind,
    at: event.at,
    responseTimeMs: event.responseTimeMs ?? null,
    expiresAt,
  })

  // ── 8. Update monitor.lastResult + lastCheckAt ───────────────────────────
  batch.update(db.collection('monitors').doc(monitorId), {
    lastResult: event.kind,
    lastCheckAt: now,
    updatedAt: now,
  })

  // ── 9. Update service.currentStatus.lastCheckAt ──────────────────────────
  batch.update(db.collection('services').doc(serviceId), {
    'currentStatus.lastCheckAt': now,
    updatedAt: now,
  })

  await batch.commit()

  // ── 10. Dispatch to incident engine (Phase 5) ────────────────────────────
  await dispatchToIncidentEngine({ monitorId, serviceId, event, previousResult, previousCheckAt })

  return NextResponse.json({ ok: true })
}
