/**
 * dns.ts — DNS record drift checker.
 *
 * Resolves configured record types for the domain and compares with expected
 * values stored in monitor.config. Emits 'down' if any drift is detected.
 *
 * Expected records are stored in monitor.config as:
 *   config.expectRecords: { A?: string[], CNAME?: string[], MX?: string[], TXT?: string[] }
 *
 * We treat CNAME and A records case-insensitively; TXT exactly.
 */

import { promises as dns } from 'dns'
import type { Monitor } from '../lib/types'

export interface DnsCheckResult {
  result: 'up' | 'down'
  responseMs: number
  error?: string
  drift?: string
}

type RecordMap = Record<string, string[]>

function parseHost(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return u.hostname
  } catch {
    return url
  }
}

/** Normalise a list of strings for comparison (trim, lowercase). */
function normalise(values: string[]): string[] {
  return values.map((v) => v.trim().toLowerCase().replace(/\.$/, '')).sort()
}

async function resolveRecords(host: string, type: string): Promise<string[]> {
  try {
    switch (type.toUpperCase()) {
      case 'A': {
        const addrs = await dns.resolve4(host)
        return addrs
      }
      case 'AAAA': {
        const addrs = await dns.resolve6(host)
        return addrs
      }
      case 'CNAME': {
        const cnames = await dns.resolveCname(host)
        return cnames
      }
      case 'MX': {
        const records = await dns.resolveMx(host)
        return records.map((r) => r.exchange)
      }
      case 'TXT': {
        const records = await dns.resolveTxt(host)
        return records.map((r) => r.join(''))
      }
      default:
        return []
    }
  } catch {
    return []
  }
}

export async function checkDNS(monitor: Monitor): Promise<DnsCheckResult> {
  const url = monitor.config.url
  if (!url) {
    return { result: 'down', responseMs: 0, error: 'No URL configured' }
  }

  // expectRecords is stored as a JSON string or an object in config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawConfig = monitor.config as any
  const expectRecords: RecordMap | undefined = rawConfig.expectRecords

  if (!expectRecords || Object.keys(expectRecords).length === 0) {
    // No expected records configured — just verify any A record resolves
    const host = parseHost(url)
    const start = Date.now()
    const addrs = await resolveRecords(host, 'A')
    const responseMs = Date.now() - start

    if (addrs.length === 0) {
      return { result: 'down', responseMs, error: `Could not resolve A record for ${host}` }
    }
    return { result: 'up', responseMs }
  }

  const host = parseHost(url)
  const start = Date.now()

  for (const [type, expected] of Object.entries(expectRecords)) {
    const actual = await resolveRecords(host, type)
    const normActual = normalise(actual)
    const normExpected = normalise(expected)

    const missing = normExpected.filter((v) => !normActual.includes(v))
    const unexpected = normActual.filter((v) => !normExpected.includes(v))

    if (missing.length > 0 || unexpected.length > 0) {
      const responseMs = Date.now() - start
      const drift = [
        missing.length > 0 ? `missing ${type}: ${missing.join(', ')}` : '',
        unexpected.length > 0 ? `unexpected ${type}: ${unexpected.join(', ')}` : '',
      ].filter(Boolean).join('; ')

      return { result: 'down', responseMs, drift, error: `DNS drift detected: ${drift}` }
    }
  }

  return { result: 'up', responseMs: Date.now() - start }
}
