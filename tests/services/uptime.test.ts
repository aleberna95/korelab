/**
 * Unit tests for computeUptime / calculateUptime.
 *
 * Tests the pure calculateUptime() function — no Firestore, no I/O.
 * Run: npx vitest run tests/services/uptime.test.ts
 */

import { describe, it, expect } from 'vitest'
import { calculateUptime } from '@/lib/services/uptime'

// Helper: create a fake incident with millisecond timestamps
function inc(startMs: number, endMs?: number) {
  return {
    startedAt: { toMillis: () => startMs },
    resolvedAt: endMs != null ? { toMillis: () => endMs } : null,
  }
}

const DAY = 86_400_000
const NOW = 1_000 * DAY // arbitrary fixed "now"
const WINDOW_START = NOW - 30 * DAY
const WINDOW_END = NOW

describe('calculateUptime', () => {
  it('0 incidents → 100% uptime, 0 downMs', () => {
    const result = calculateUptime([], WINDOW_START, WINDOW_END)
    expect(result.uptimePct).toBe(100)
    expect(result.downMs).toBe(0)
    expect(result.segments).toHaveLength(0)
  })

  it('1 resolved incident of 1 day → ~96.67% uptime', () => {
    const start = NOW - 2 * DAY
    const end = NOW - 1 * DAY
    const result = calculateUptime([inc(start, end)], WINDOW_START, WINDOW_END)

    expect(result.downMs).toBe(DAY)
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]).toEqual({ start, end })
    expect(result.uptimePct).toBeCloseTo((29 / 30) * 100, 5)
  })

  it('2 non-overlapping incidents → sums downtime', () => {
    const a = inc(NOW - 10 * DAY, NOW - 9 * DAY) // 1 day down
    const b = inc(NOW - 5 * DAY, NOW - 4 * DAY)  // 1 day down
    const result = calculateUptime([a, b], WINDOW_START, WINDOW_END)

    expect(result.downMs).toBe(2 * DAY)
    expect(result.segments).toHaveLength(2)
    expect(result.uptimePct).toBeCloseTo((28 / 30) * 100, 5)
  })

  it('ongoing incident (no resolvedAt) → counts until windowEnd', () => {
    const start = NOW - 1 * DAY
    const result = calculateUptime([inc(start)], WINDOW_START, WINDOW_END)

    expect(result.downMs).toBe(DAY)
    expect(result.segments[0]).toEqual({ start, end: WINDOW_END })
    expect(result.uptimePct).toBeCloseTo((29 / 30) * 100, 5)
  })

  it('incident fully outside window → ignored', () => {
    const result = calculateUptime(
      [inc(NOW - 100 * DAY, NOW - 50 * DAY)],
      WINDOW_START,
      WINDOW_END,
    )
    expect(result.downMs).toBe(0)
    expect(result.uptimePct).toBe(100)
  })

  it('incident partially overlapping window start → clipped', () => {
    // Starts 5 days before window, ends 5 days into window
    const result = calculateUptime(
      [inc(WINDOW_START - 5 * DAY, WINDOW_START + 5 * DAY)],
      WINDOW_START,
      WINDOW_END,
    )
    expect(result.downMs).toBe(5 * DAY)
    expect(result.segments[0].start).toBe(WINDOW_START)
    expect(result.segments[0].end).toBe(WINDOW_START + 5 * DAY)
  })

  it('100% down → 0% uptime, clamped (not negative)', () => {
    const result = calculateUptime(
      [inc(WINDOW_START, WINDOW_END)],
      WINDOW_START,
      WINDOW_END,
    )
    expect(result.uptimePct).toBe(0)
    expect(result.downMs).toBe(30 * DAY)
  })

  it('zero-length window → returns 100% immediately', () => {
    const result = calculateUptime([], NOW, NOW)
    expect(result.uptimePct).toBe(100)
    expect(result.downMs).toBe(0)
  })
})
