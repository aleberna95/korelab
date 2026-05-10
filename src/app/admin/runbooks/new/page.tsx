import { requireAdmin } from '@/lib/auth/guards'
import Link from 'next/link'
import { RunbookForm } from '../RunbookForm'

export default async function NewRunbookPage() {
  await requireAdmin()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/runbooks" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Runbooks
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New Runbook</h1>
      </div>

      <RunbookForm />
    </div>
  )
}
