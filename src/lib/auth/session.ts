import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { getAdminAuth } from '@/lib/firebase/admin'

const SESSION_COOKIE_NAME = '__session'
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000 // 5 days

/**
 * Creates a session cookie from a Firebase ID token.
 * Call this in the POST /api/auth/session route handler.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  const auth = getAdminAuth()
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  })
  return sessionCookie
}

/**
 * Verifies the session cookie and returns the decoded claims.
 * Returns null if the cookie is missing, invalid, or revoked.
 *
 * Wrapped with React.cache() so it runs at most once per server request,
 * even when called by both the admin layout and individual page components.
 */
export const verifySessionCookie = cache(async (): Promise<{
  uid: string
  role: string | undefined
} | null> => {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) return null

  try {
    const auth = getAdminAuth()
    const decoded = await auth.verifySessionCookie(sessionCookie, true)
    return {
      uid: decoded.uid,
      role: decoded.role as string | undefined,
    }
  } catch {
    return null
  }
})

/**
 * Cookie options for Set-Cookie header.
 */
export const sessionCookieOptions = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS / 1000, // seconds
}
