/**
 * Unit tests for the incident state machine.
 *
 * Pure table-driven tests — no Firestore, no I/O.
 * Run: npx vitest run tests/incidents/transitions.test.ts
 */

import { describe, it, expect } from 'vitest'
import { canTransition, applyEngineEvent, type IncidentState } from '@/lib/incidents/transitions'

const ALL_STATES: IncidentState[] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'false-positive',
]

describe('canTransition', () => {
  describe('investigating', () => {
    it('→ identified', () => expect(canTransition('investigating', 'identified')).toBe(true))
    it('→ monitoring', () => expect(canTransition('investigating', 'monitoring')).toBe(true))
    it('→ resolved', () => expect(canTransition('investigating', 'resolved')).toBe(true))
    it('→ false-positive', () => expect(canTransition('investigating', 'false-positive')).toBe(true))
    it('→ self (invalid)', () => expect(canTransition('investigating', 'investigating')).toBe(false))
  })

  describe('identified', () => {
    it('→ monitoring', () => expect(canTransition('identified', 'monitoring')).toBe(true))
    it('→ resolved', () => expect(canTransition('identified', 'resolved')).toBe(true))
    it('→ false-positive', () => expect(canTransition('identified', 'false-positive')).toBe(true))
    it('→ investigating (invalid)', () => expect(canTransition('identified', 'investigating')).toBe(false))
  })

  describe('monitoring', () => {
    it('→ investigating (re-open)', () => expect(canTransition('monitoring', 'investigating')).toBe(true))
    it('→ resolved', () => expect(canTransition('monitoring', 'resolved')).toBe(true))
    it('→ false-positive', () => expect(canTransition('monitoring', 'false-positive')).toBe(true))
    it('→ identified (invalid)', () => expect(canTransition('monitoring', 'identified')).toBe(false))
  })

  describe('resolved', () => {
    it('→ investigating (re-open)', () => expect(canTransition('resolved', 'investigating')).toBe(true))
    it('→ monitoring (invalid)', () => expect(canTransition('resolved', 'monitoring')).toBe(false))
    it('→ false-positive (invalid)', () => expect(canTransition('resolved', 'false-positive')).toBe(false))
  })

  describe('false-positive', () => {
    it('is terminal — no allowed transitions', () => {
      for (const target of ALL_STATES) {
        expect(canTransition('false-positive', target)).toBe(false)
      }
    })
  })
})

describe('applyEngineEvent', () => {
  describe('down event', () => {
    it('monitoring → investigating (flap back)', () => {
      expect(applyEngineEvent('monitoring', 'down')).toBe('investigating')
    })
    it('investigating → null (already active)', () => {
      expect(applyEngineEvent('investigating', 'down')).toBeNull()
    })
    it('identified → null (already active)', () => {
      expect(applyEngineEvent('identified', 'down')).toBeNull()
    })
    it('resolved → null', () => {
      expect(applyEngineEvent('resolved', 'down')).toBeNull()
    })
    it('false-positive → null', () => {
      expect(applyEngineEvent('false-positive', 'down')).toBeNull()
    })
  })

  describe('up event', () => {
    it('investigating → monitoring', () => {
      expect(applyEngineEvent('investigating', 'up')).toBe('monitoring')
    })
    it('identified → monitoring', () => {
      expect(applyEngineEvent('identified', 'up')).toBe('monitoring')
    })
    it('monitoring → null (already monitoring)', () => {
      expect(applyEngineEvent('monitoring', 'up')).toBeNull()
    })
    it('resolved → null', () => {
      expect(applyEngineEvent('resolved', 'up')).toBeNull()
    })
    it('false-positive → null', () => {
      expect(applyEngineEvent('false-positive', 'up')).toBeNull()
    })
  })
})
