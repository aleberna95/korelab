/**
 * Unit tests for the UptimeRobot webhook payload normalizer.
 *
 * Run: npx vitest run tests/webhooks/normalize.test.ts
 */

import { describe, it, expect } from 'vitest'
import { normalizeUrPayload } from '@/lib/webhooks/uptimerobot/normalize'

// Sample payloads from UptimeRobot documentation (form-encoded fields as an object)
const DOWN_PAYLOAD = {
  monitorID: '12345678',
  monitorURL: 'https://acme.com',
  monitorFriendlyName: 'ACME Website',
  alertType: '1',
  alertTypeFriendlyName: 'Down',
  alertDetails: 'Connection timed out after 30 seconds',
  alertDateTime: '2026-05-09 10:00:00',
  responseTime: '',
}

const UP_PAYLOAD = {
  monitorID: '12345678',
  monitorURL: 'https://acme.com',
  monitorFriendlyName: 'ACME Website',
  alertType: '2',
  alertTypeFriendlyName: 'Up',
  alertDetails: 'Site is back online',
  alertDuration: '300',
  alertDateTime: '2026-05-09 10:05:00',
  responseTime: '142',
}

const PAUSED_PAYLOAD = {
  monitorID: '12345678',
  alertType: '99',
  alertTypeFriendlyName: 'Paused',
  alertDetails: 'Monitor paused due to too many alerts',
  alertDateTime: '2026-05-09 10:10:00',
}

describe('normalizeUrPayload', () => {
  describe('DOWN alert', () => {
    it('produces kind=down', () => {
      const e = normalizeUrPayload(DOWN_PAYLOAD)
      expect(e.kind).toBe('down')
    })

    it('sets externalMonitorId from monitorID', () => {
      const e = normalizeUrPayload(DOWN_PAYLOAD)
      expect(e.externalMonitorId).toBe('12345678')
    })

    it('parses alertDateTime into a Date', () => {
      const e = normalizeUrPayload(DOWN_PAYLOAD)
      expect(e.at).toBeInstanceOf(Date)
      expect(isNaN(e.at.getTime())).toBe(false)
    })

    it('omits responseTimeMs when responseTime is empty', () => {
      const e = normalizeUrPayload(DOWN_PAYLOAD)
      expect(e.responseTimeMs).toBeUndefined()
    })

    it('generates a deterministic externalEventId', () => {
      const e1 = normalizeUrPayload(DOWN_PAYLOAD)
      const e2 = normalizeUrPayload(DOWN_PAYLOAD)
      expect(e1.externalEventId).toBe(e2.externalEventId)
    })

    it('externalEventId differs from the UP payload', () => {
      const down = normalizeUrPayload(DOWN_PAYLOAD)
      const up = normalizeUrPayload(UP_PAYLOAD)
      expect(down.externalEventId).not.toBe(up.externalEventId)
    })
  })

  describe('UP alert', () => {
    it('produces kind=up', () => {
      const e = normalizeUrPayload(UP_PAYLOAD)
      expect(e.kind).toBe('up')
    })

    it('parses responseTime into responseTimeMs', () => {
      const e = normalizeUrPayload(UP_PAYLOAD)
      expect(e.responseTimeMs).toBe(142)
    })
  })

  describe('PAUSED alert', () => {
    it('produces kind=paused', () => {
      const e = normalizeUrPayload(PAUSED_PAYLOAD)
      expect(e.kind).toBe('paused')
    })

    it('handles missing fields gracefully', () => {
      const e = normalizeUrPayload(PAUSED_PAYLOAD)
      expect(e.externalMonitorId).toBe('12345678')
      expect(e.at).toBeInstanceOf(Date)
    })
  })

  describe('edge cases', () => {
    it('defaults to kind=down for unknown alertType', () => {
      const e = normalizeUrPayload({ monitorID: '1', alertType: '99999' })
      // 99999 is not 2 (up) or 99 (paused), so treated as down
      expect(e.kind).toBe('down')
    })

    it('falls back to now when alertDateTime is missing', () => {
      const before = Date.now()
      const e = normalizeUrPayload({ monitorID: '1' })
      const after = Date.now()
      expect(e.at.getTime()).toBeGreaterThanOrEqual(before)
      expect(e.at.getTime()).toBeLessThanOrEqual(after)
    })

    it('falls back to now when alertDateTime is invalid', () => {
      const e = normalizeUrPayload({ monitorID: '1', alertDateTime: 'not-a-date' })
      expect(e.at).toBeInstanceOf(Date)
      expect(isNaN(e.at.getTime())).toBe(false)
    })

    it('handles numeric monitorID', () => {
      const e = normalizeUrPayload({ monitorID: 42 })
      expect(e.externalMonitorId).toBe('42')
    })
  })
})
