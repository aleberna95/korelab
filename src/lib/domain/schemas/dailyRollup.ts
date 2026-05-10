import { z } from 'zod'

/** Written by the nightly dailyRollup Cloud Function. */
export const DailyRollupSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  uptimePct: z.number().min(0).max(100),
  downtimeSec: z.number().int().min(0),
  incidentCount: z.number().int().min(0),
  avgResponseMs: z.number().min(0).optional(),
  checks: z.number().int().min(0),
  downChecks: z.number().int().min(0),
})

export type DailyRollup = z.infer<typeof DailyRollupSchema>
