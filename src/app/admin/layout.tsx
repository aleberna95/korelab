import { cache } from 'react'
import { requireAdmin } from '@/lib/auth/guards'
import { AdminShell } from '@/components/layout/AdminShell'

/**
 * Cached per-request lookup of the admin user's email.
 * Uses React.cache() so it dedups with requireAdmin() which calls verifySessionCookie().
 */
const getAdminEmail = cache(async (uid: string): Promise<string> => {
  try {
    const { getAdminAuth } = await import('@/lib/firebase/admin')
    const auth = getAdminAuth()
    const user = await auth.getUser(uid)
    return user.email ?? uid
  } catch {
    return uid
  }
})

/**
 * Admin layout — verifies admin session on every navigation,
 * then wraps child pages in the AdminShell.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Full server-side auth check (crypto + role claim).
  // verifySessionCookie() is React.cache()'d, so any requireAdmin() call in a
  // child page re-uses the same result within this request — no double verify.
  const session = await requireAdmin()
  const userEmail = await getAdminEmail(session.uid)

  return <AdminShell userEmail={userEmail}>{children}</AdminShell>
}
