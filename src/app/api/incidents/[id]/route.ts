/**
 * PATCH /api/incidents/[id] — Manual incident update by admin.
 * GET  /api/incidents/[id] — Fetch incident + timeline.
 *
 * PATCH validates state transitions via canTransition().
 * All changes are audit-logged.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/guards'
import { incidentsRepo } from '@/lib/repos/incidentsRepo'
import { canTransition, type IncidentState } from '@/lib/incidents/transitions'

const PatchSchema = z.object({
  state: z
    .enum(['investigating', 'identified', 'monitoring', 'resolved', 'false-positive'])
    .optional(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
  title: z.string().min(1).max(200).optional(),
  publicMessage: z.string().max(2000).optional(),
  privateMessage: z.string().max(2000).optional(),
  rootCause: z.string().max(2000).optional(),
  resolution: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'tokenized', 'public']).optional(),
  notifiedClient: z.boolean().optional(),
  /** If provided, written as a 'comment' timeline event */
  comment: z.string().max(1000).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { uid } = await requireAdmin()
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { comment, ...incidentPatch } = parsed.data

  const incident = await incidentsRepo.getById(id)
  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Validate state transition
  if (incidentPatch.state && incidentPatch.state !== incident.state) {
    if (!canTransition(incident.state as IncidentState, incidentPatch.state as IncidentState)) {
      return NextResponse.json(
        { error: `Transition '${incident.state}' → '${incidentPatch.state}' is not allowed` },
        { status: 409 },
      )
    }
  }

  const timelineMessage =
    comment ??
    (incidentPatch.state ? `State changed to ${incidentPatch.state} by admin` : undefined)

  await incidentsRepo.update(id, incidentPatch, timelineMessage, uid)

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: Params) {
  await requireAdmin()
  const { id } = await params

  const [incident, timeline] = await Promise.all([
    incidentsRepo.getById(id),
    incidentsRepo.getTimeline(id),
  ])

  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ incident, timeline })
}
