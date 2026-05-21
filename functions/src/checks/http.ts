/**
 * http.ts — Custom HTTP health checker.
 *
 * GETs the configured URL, asserts status code and optional body fragment.
 * Uses native fetch (Node 22+) with a hard timeout.
 */

import type { ServiceCheck } from '../lib/types'

export interface HttpCheckResult {
  result: 'up' | 'down' | 'degraded'
  responseMs: number
  statusCode?: number
  error?: string
}

const DEFAULT_TIMEOUT_MS = 5_000

export async function checkHTTP(check: ServiceCheck): Promise<HttpCheckResult> {
  const url = check.url

  if (!url) {
    return { result: 'down', responseMs: 0, error: 'No URL configured' }
  }

  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const expectStatus = check.expectStatus ?? 200
  const expectBody = check.expectBody

  const start = Date.now()

  // Retry once after 2 s backoff on network errors
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2_000))
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let res: Response
      try {
        res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'CommandCenter/1.0 (health-check)' },
          redirect: 'follow',
        })
      } finally {
        clearTimeout(timer)
      }

      const responseMs = Date.now() - start
      const statusCode = res.status

      if (statusCode !== expectStatus) {
        return {
          result: 'down',
          responseMs,
          statusCode,
          error: `Expected status ${expectStatus}, got ${statusCode}`,
        }
      }

      if (expectBody) {
        const text = await res.text()
        if (!text.includes(expectBody)) {
          return {
            result: 'degraded',
            responseMs,
            statusCode,
            error: `Body does not contain expected fragment`,
          }
        }
      }

      return { result: 'up', responseMs, statusCode }
    } catch (err) {
      if (attempt === 1) {
        return {
          result: 'down',
          responseMs: Date.now() - start,
          error: err instanceof Error ? err.message : 'Fetch failed',
        }
      }
    }
  }

  return { result: 'down', responseMs: Date.now() - start, error: 'Unreachable' }
}
