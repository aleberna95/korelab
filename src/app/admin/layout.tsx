import { requireAdmin } from '@/lib/auth/guards'
import { AdminShell } from '@/components/layout/AdminShell'

/**
 * Admin layout — verifies admin session on every navigation,
 * then wraps child pages in the AdminShell.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Full server-side auth check (crypto + role claim)
  const session = await requireAdmin()

  // Fetch email to pass to Topbar (Admin SDK is server-only)
  let userEmail = session.uid
  try {
    const { getAdminAuth } = await import('@/lib/firebase/admin')
    const auth = getAdminAuth()
    const user = await auth.getUser(session.uid)
    userEmail = user.email ?? session.uid
  } catch {
    // Non-critical — fall back to uid
  }

  return <AdminShell userEmail={userEmail}>{children}</AdminShell>
}
