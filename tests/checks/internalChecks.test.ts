/**
 * Tests for internal checks.
 *
 * Coverage:
 *  - alertLadder: threshold crossing logic + already-alerted deduplication
 *  - http checker: status match, body fragment, wrong status, no URL
 *  - determineHttpAction: transition logic (UP↔DOWN, zero writes on steady state)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findCrossedThreshold, SSL_THRESHOLDS } from '@functions/checks/alertLadder'

// ─── Alert Ladder ─────────────────────────────────────────────────────────

describe('findCrossedThreshold', () => {
  it('returns highest crossed threshold when none alerted yet', () => {
    // daysToExpiry=10 with thresholds [30,14,7,2] descending: 10<=30 first hit → 30
    expect(findCrossedThreshold(10, SSL_THRESHOLDS, [])).toBe(30)
  })

  it('returns next un-alerted threshold when some are already recorded', () => {
    // Already alerted at 14; now at 6 days → should cross 7
    expect(findCrossedThreshold(6, SSL_THRESHOLDS, [30, 14])).toBe(7)
  })

  it('returns null when all crossed thresholds already alerted', () => {
    expect(findCrossedThreshold(6, SSL_THRESHOLDS, [30, 14, 7])).toBeNull()
  })

  it('returns null when daysToExpiry is above all thresholds', () => {
    expect(findCrossedThreshold(60, SSL_THRESHOLDS, [])).toBeNull()
  })

  it('handles exactly-at-threshold value (<=)', () => {
    expect(findCrossedThreshold(30, SSL_THRESHOLDS, [])).toBe(30)
    expect(findCrossedThreshold(30, SSL_THRESHOLDS, [30])).toBeNull()
  })

  it('works correctly for domain thresholds', () => {
    // SSL_THRESHOLDS = [30,14,7,2] in descending order
    // 25 days: crosses 30 → fires at 30
    expect(findCrossedThreshold(25, SSL_THRESHOLDS, [])).toBe(30)
    // 25 days, already alerted at 30: 25 > 14 so 14 not yet crossed → null
    expect(findCrossedThreshold(25, SSL_THRESHOLDS, [30])).toBeNull()
    // 6 days, alerted at 30+14: 6 <= 7 and not alerted → fires at 7
    expect(findCrossedThreshold(6, SSL_THRESHOLDS, [30, 14])).toBe(7)
  })

  it('returns null when daysToExpiry is negative and all thresholds already alerted', () => {
    // Expired — all thresholds have been crossed; if all alerted → null
    expect(findCrossedThreshold(-5, SSL_THRESHOLDS, [30, 14, 7, 2])).toBeNull()
  })

  it('returns lowest un-alerted threshold for expired cert', () => {
    // Expired (-1 days) — lowest threshold is 2, if not yet alerted → 2
    expect(findCrossedThreshold(-1, SSL_THRESHOLDS, [30, 14, 7])).toBe(2)
  })
})

// ─── HTTP Checker ─────────────────────────────────────────────────────────

describe('checkHTTP', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns up for 200 response matching expected status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { checkHTTP } = await import('@functions/checks/http')
    const check = {
      enabled: true,
      url: 'https://example.com',
      expectStatus: 200,
      intervalSec: 60,
      timeoutMs: 5000,
      sslCheck: false,
      sslAlertDays: [],
      alertedThresholds: [],
    }

    const result = await checkHTTP(check)
    expect(result.result).toBe('up')
    expect(result.statusCode).toBe(200)
  })

  it('returns down when status does not match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as unknown as Response))

    const { checkHTTP } = await import('@functions/checks/http')
    const check = {
      enabled: true,
      url: 'https://example.com',
      expectStatus: 200,
      intervalSec: 60,
      timeoutMs: 5000,
      sslCheck: false,
      sslAlertDays: [],
      alertedThresholds: [],
    }

    const result = await checkHTTP(check)
    expect(result.result).toBe('down')
    expect(result.statusCode).toBe(503)
  })

  it('returns degraded when body fragment missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Hello world',
    } as unknown as Response))

    const { checkHTTP } = await import('@functions/checks/http')
    const check = {
      enabled: true,
      url: 'https://example.com',
      expectStatus: 200,
      expectBody: 'EXPECTED_TEXT',
      intervalSec: 60,
      timeoutMs: 5000,
      sslCheck: false,
      sslAlertDays: [],
      alertedThresholds: [],
    }

    const result = await checkHTTP(check)
    expect(result.result).toBe('degraded')
  })

  it('returns up when body fragment is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Hello EXPECTED_TEXT world',
    } as unknown as Response))

    const { checkHTTP } = await import('@functions/checks/http')
    const check = {
      enabled: true,
      url: 'https://example.com',
      expectStatus: 200,
      expectBody: 'EXPECTED_TEXT',
      intervalSec: 60,
      timeoutMs: 5000,
      sslCheck: false,
      sslAlertDays: [],
      alertedThresholds: [],
    }

    const result = await checkHTTP(check)
    expect(result.result).toBe('up')
  })

  it('returns down when no URL configured', async () => {
    const { checkHTTP } = await import('@functions/checks/http')
    const check = {
      enabled: true,
      url: '',
      intervalSec: 60,
      timeoutMs: 5000,
      sslCheck: false,
      sslAlertDays: [],
      alertedThresholds: [],
    }

    const result = await checkHTTP(check)
    expect(result.result).toBe('down')
    expect(result.error).toContain('No URL')
  })
})

// ─── determineHttpAction (transition logic) ───────────────────────────────

describe('determineHttpAction', () => {
  const check = {
    enabled: true,
    url: 'https://example.com',
    intervalSec: 60,
    timeoutMs: 5000,
    sslCheck: false,
    sslAlertDays: [],
    alertedThresholds: [],
  }

  it('UP→UP: returns none (zero writes)', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    expect(determineHttpAction('up', 'operational', check)).toEqual({ type: 'none' })
  })

  it('UP→DOWN: returns open_incident with title', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    const action = determineHttpAction('down', 'operational', check, 'connection refused')
    expect(action.type).toBe('open_incident')
    expect((action as { type: string; title: string }).title).toContain('https://example.com')
  })

  it('DOWN→DOWN: returns none (zero writes)', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    expect(determineHttpAction('down', 'major-outage', check)).toEqual({ type: 'none' })
  })

  it('DOWN→UP: returns close_incident', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    expect(determineHttpAction('up', 'major-outage', check)).toEqual({ type: 'close_incident' })
  })

  it('degraded when operational: returns open_incident', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    const action = determineHttpAction('degraded', 'operational', check)
    expect(action.type).toBe('open_incident')
  })

  it('unknown state + down: returns open_incident', async () => {
    const { determineHttpAction } = await import('@functions/checks/transitions')
    const action = determineHttpAction('down', 'unknown', check)
    expect(action.type).toBe('open_incident')
  })
})
