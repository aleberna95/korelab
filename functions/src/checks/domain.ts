/**
 * domain.ts — Domain expiry checker via WHOIS JSON API.
 *
 * API key is fetched from Secret Manager (secret: whois-api-key) and cached.
 * Uses whoisjsonapi.com; falls back to graceful error on 4xx/5xx.
 *
 * Returns daysToExpiry so the caller can apply the alert ladder.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import type { Monitor } from '../lib/types'

export interface DomainCheckResult {
  result: 'up' | 'degraded' | 'down'
  responseMs: number
  daysToExpiry?: number
  error?: string
}

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'korelab-cc'
const TIMEOUT_MS = 8_000 // WHOIS APIs can be slow

const smClient = new SecretManagerServiceClient()
let _apiKey: string | null = null

async function getWhoisApiKey(): Promise<string> {
  if (_apiKey) return _apiKey

  const [version] = await smClient.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/whois-api-key/versions/latest`,
  })

  const raw = version.payload?.data
  if (!raw) throw new Error('[domain] Secret whois-api-key is empty')

  _apiKey = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf-8')
  return _apiKey
}

function parseHost(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    // Strip subdomain to get registrable domain — naïve split on last two parts
    const parts = u.hostname.split('.')
    return parts.length >= 2 ? parts.slice(-2).join('.') : u.hostname
  } catch {
    return url
  }
}

export async function checkDomain(monitor: Monitor): Promise<DomainCheckResult> {
  const url = monitor.config.url
  if (!url) {
    return { result: 'down', responseMs: 0, error: 'No URL configured' }
  }

  const domain = parseHost(url)
  const start = Date.now()

  try {
    const apiKey = await getWhoisApiKey()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let data: Record<string, unknown>
    try {
      const res = await fetch(
        `https://www.whoisjsonapi.com/v1/${encodeURIComponent(domain)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        },
      )

      if (!res.ok) {
        return {
          result: 'degraded',
          responseMs: Date.now() - start,
          error: `WHOIS API returned ${res.status}`,
        }
      }

      data = (await res.json()) as Record<string, unknown>
    } finally {
      clearTimeout(timer)
    }

    // Parse expiry date — whoisjsonapi returns `domain.expiration_date`
    const domainInfo = data['domain'] as Record<string, unknown> | undefined
    const expiryStr = domainInfo?.['expiration_date'] as string | undefined

    if (!expiryStr) {
      return {
        result: 'degraded',
        responseMs: Date.now() - start,
        error: 'Could not parse domain expiry date from WHOIS response',
      }
    }

    const expiryDate = new Date(expiryStr)
    if (isNaN(expiryDate.getTime())) {
      return {
        result: 'degraded',
        responseMs: Date.now() - start,
        error: `Unparseable expiry date: ${expiryStr}`,
      }
    }

    const daysToExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )

    if (daysToExpiry < 0) {
      return { result: 'down', responseMs: Date.now() - start, daysToExpiry, error: 'Domain has expired' }
    }

    if (daysToExpiry <= 7) {
      return { result: 'degraded', responseMs: Date.now() - start, daysToExpiry }
    }

    return { result: 'up', responseMs: Date.now() - start, daysToExpiry }
  } catch (err) {
    return {
      result: 'degraded',
      responseMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'WHOIS check failed',
    }
  }
}
