import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * Cache tags used across the app.
 * Server actions call revalidateTag() with these to bust the cache on mutations.
 */
export const CACHE_TAGS = {
  services: 'services',
  tasks: 'tasks',
  incidents: 'incidents',
  monitors: 'monitors',
  audit: 'audit',
} as const

/**
 * Wrap an async function with Next.js unstable_cache.
 * Short TTL (default 30s) so admin sees near-realtime data,
 * but avoids re-querying Firestore on every navigation/refresh.
 */
export function cached<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  opts: { tags: string[]; revalidate?: number },
): Promise<T> {
  const cachedFn = unstable_cache(fn, keyParts, {
    tags: opts.tags,
    revalidate: opts.revalidate ?? 30,
  })
  return cachedFn()
}
