import 'server-only'
import { redirect } from 'next/navigation'
import { verifySessionCookie } from './session'

/**
 * Verifies the session cookie and asserts the caller has the 'admin' role.
 * If not, redirects to /login.
 *
 * Use at the top of every admin Server Component or Route Handler.
 *
 * @returns Decoded session { uid, role }
 */
export async function requireAdmin(): Promise<{ uid: string; role: string }> {
  const session = await verifySessionCookie()

  if (!session || session.role !== 'admin') {
    redirect('/login')
  }

  return { uid: session.uid, role: session.role }
}
