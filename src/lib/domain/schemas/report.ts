import { z } from 'zod'

const ReportIncidentSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  /** ISO datetime strings — stored as Timestamps in Firestore */
  startedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  downtimeSec: z.number().int().min(0).optional(),
  severity: z.enum(['minor', 'major', 'critical']),
  publicMessage: z.string().optional(),
})

const ReportMaintenanceSummarySchema = z.object({
  id: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  title: z.string(),
})

export const CreateReportSchema = z.object({
  serviceId: z.string().min(1),
  clientId: z.string().min(1),
  period: z.object({
    kind: z.enum(['monthly', 'custom']),
    /** ISO datetime strings */
    from: z.string().datetime(),
    to: z.string().datetime(),
    label: z.string().min(1),
  }),
  metrics: z.object({
    uptimePct: z.number().min(0).max(100),
    downtimeSec: z.number().int().min(0),
    incidentCount: z.number().int().min(0),
    mttrSec: z.number().int().min(0).optional(),
    avgResponseMs: z.number().min(0).optional(),
    checks: z.number().int().min(0),
  }),
  incidents: z.array(ReportIncidentSummarySchema).default([]),
  maintenance: z.array(ReportMaintenanceSummarySchema).default([]),
  notes: z.object({
    client: z.string().optional(),
    private: z.string().optional(),
  }),
  visibility: z.enum(['private', 'tokenized', 'email']).default('private'),
  generatedBy: z.enum(['auto', 'manual']),
  generatedByUid: z.string().optional(),
})

export const UpdateReportSchema = CreateReportSchema.pick({
  notes: true,
  visibility: true,
}).partial()

export type CreateReportInput = z.infer<typeof CreateReportSchema>
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>
