/**
 * ssl.ts — TLS certificate checker.
 *
 * Connects to host:443 (or config port), performs TLS handshake,
 * extracts the certificate's valid_to date and computes daysToExpiry.
 *
 * Returns a CheckResult that the caller uses to decide whether to open an incident.
 */

import * as tls from 'tls'
import type { Monitor } from '../lib/types'

export interface SSLCheckResult {
  result: 'up' | 'down' | 'degraded'
  responseMs: number
  daysToExpiry?: number
  error?: string
}

const DEFAULT_TIMEOUT_MS = 5_000

/**
 * Extracts the hostname from a URL string or returns it as-is.
 * e.g. "https://example.com" → "example.com"
 */
function parseHost(url: string): { host: string; port: number } {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 443,
    }
  } catch {
    return { host: url, port: 443 }
  }
}

export async function checkSSL(monitor: Monitor): Promise<SSLCheckResult> {
  const url = monitor.config.url
  if (!url) {
    return { result: 'down', responseMs: 0, error: 'No URL configured' }
  }

  const { host, port } = parseHost(url)
  const timeoutMs = monitor.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const start = Date.now()

  return new Promise<SSLCheckResult>((resolve) => {
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({
        result: 'down',
        responseMs: Date.now() - start,
        error: `TLS connect timeout after ${timeoutMs}ms`,
      })
    }, timeoutMs)

    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: true },
      () => {
        clearTimeout(timer)
        const responseMs = Date.now() - start

        try {
          const cert = socket.getPeerCertificate()
          socket.destroy()

          if (!cert || !cert.valid_to) {
            resolve({ result: 'down', responseMs, error: 'Could not read certificate' })
            return
          }

          const expiryDate = new Date(cert.valid_to)
          const now = new Date()
          const daysToExpiry = Math.floor(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )

          if (daysToExpiry < 0) {
            resolve({
              result: 'down',
              responseMs,
              daysToExpiry,
              error: 'Certificate has expired',
            })
          } else if (daysToExpiry <= 7) {
            resolve({ result: 'degraded', responseMs, daysToExpiry })
          } else {
            resolve({ result: 'up', responseMs, daysToExpiry })
          }
        } catch (err) {
          resolve({
            result: 'down',
            responseMs,
            error: err instanceof Error ? err.message : 'Unknown error reading cert',
          })
        }
      },
    )

    socket.on('error', (err) => {
      clearTimeout(timer)
      socket.destroy()
      resolve({
        result: 'down',
        responseMs: Date.now() - start,
        error: err.message,
      })
    })
  })
}
