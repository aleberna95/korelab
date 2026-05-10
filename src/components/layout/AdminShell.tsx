import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AdminShellProps {
  children: React.ReactNode
  userEmail: string
}

/**
 * Server Component wrapper — passes userEmail from the server to the Topbar.
 * Sidebar and Topbar are Client Components for interactivity.
 */
export function AdminShell({ children, userEmail }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar userEmail={userEmail} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
