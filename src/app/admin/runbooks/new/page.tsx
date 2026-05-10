import { requireAdmin } from '@/lib/auth/guards'
import Link from 'next/link'
import { RunbookForm } from '../RunbookForm'

export default async function NewRunbookPage() {
  await requireAdmin()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/admin/runbooks" className="text-sm text-gray-500 hover:text-gray-700">
          ← Runbooks
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">New Runbook</h1>
      </div>

      <RunbookForm />
    </div>
  )
}
