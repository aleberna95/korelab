/**
 * Thin TypeScript client for the UptimeRobot v2 API.
 *
 * API key is fetched from Google Secret Manager once per cold start and
 * cached for the lifetime of the function instance. The key is NEVER logged.
 *
 * All requests have a 5 s timeout and one retry with 1 s exponential backoff.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import type {
  GetMonitorsResponse,
  NewMonitorResponse,
  EditMonitorResponse,
  DeleteMonitorResponse,
  UrMonitor,
} from './types'

const API_BASE = 'https://api.uptimerobot.com/v2'
const TIMEOUT_MS = 5_000
const SECRET_NAME = 'uptimerobot-api-key'

// Cached API key — set once per cold start
let _apiKey: string | null = null

async function getApiKey(): Promise<string> {
  if (_apiKey) return _apiKey

  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) throw new Error('GCLOUD_PROJECT env var not set')

  const secretName = `projects/${projectId}/secrets/${SECRET_NAME}/versions/latest`
  const client = new SecretManagerServiceClient()
  const [version] = await client.accessSecretVersion({ name: secretName })
  const payload = version.payload?.data
  if (!payload) throw new Error('Secret payload is empty')

  _apiKey = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8')
  return _apiKey
}

// ─── HTTP helper ───────────────────────────────────────────────────────────

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = await getApiKey()

  const params = new URLSearchParams({
    api_key: apiKey,
    format: 'json',
    ...Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, String(v)]),
    ),
  })

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1_000 * attempt))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        throw new Error(`UptimeRobot API HTTP ${res.status}`)
      }

      const data = (await res.json()) as T & { stat: string; error?: { message: string } }
      if (data.stat !== 'ok') {
        throw new Error(`UptimeRobot API error: ${data.error?.message ?? 'unknown'}`)
      }

      return data
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError ?? new Error('UptimeRobot request failed')
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Fetch one or all monitors. Pass externalIds to filter. */
export async function getMonitors(externalIds?: number[]): Promise<UrMonitor[]> {
  const body: Record<string, unknown> = {
    logs: 0,
    response_times: 0,
    monitors: externalIds?.join('-') ?? '',
  }
  const res = await post<GetMonitorsResponse>('getMonitors', body)
  return res.monitors ?? []
}

/** Create a new HTTP monitor. Returns the UptimeRobot monitor ID. */
export async function newMonitor(params: {
  friendlyName: string
  url: string
  intervalSec: number
  expectStatus?: number
}): Promise<number> {
  const body: Record<string, unknown> = {
    friendly_name: params.friendlyName,
    url: params.url,
    type: 1, // HTTP
    interval: params.intervalSec,
  }
  // UptimeRobot keyword monitoring for status: we rely on HTTP status code check
  // (type=1 checks the URL; non-2xx → down)
  const res = await post<NewMonitorResponse>('newMonitor', body)
  return res.monitor.id
}

/** Edit an existing monitor by UptimeRobot ID. */
export async function editMonitor(
  externalId: number,
  params: {
    friendlyName?: string
    url?: string
    intervalSec?: number
    active?: boolean
  },
): Promise<void> {
  const body: Record<string, unknown> = { id: externalId }

  if (params.friendlyName !== undefined) body.friendly_name = params.friendlyName
  if (params.url !== undefined) body.url = params.url
  if (params.intervalSec !== undefined) body.interval = params.intervalSec
  if (params.active !== undefined) {
    // UptimeRobot: status=0 pauses, status=1 resumes
    body.status = params.active ? 1 : 0
  }

  await post<EditMonitorResponse>('editMonitor', body)
}

/** Delete a monitor by UptimeRobot ID. */
export async function deleteMonitor(externalId: number): Promise<void> {
  await post<DeleteMonitorResponse>('deleteMonitor', { id: externalId })
}
