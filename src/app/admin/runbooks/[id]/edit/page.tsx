import { requireAdmin } from '@/lib/auth/guards'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RunbookForm } from '../../RunbookForm'
import { DeleteRunbookButton } from './DeleteRunbookButton'

type Props = { params: Promise<{ id: string }> }

export default async function EditRunbookPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const runbook = await runbooksRepo.getById(id)
  if (!runbook) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href={`/admin/runbooks/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {runbook.title}
        </Link>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">Edit Runbook</h1>
      </div>

      <RunbookForm runbook={runbook} />

      <div className="border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-500 mb-3">Danger zone</p>
        <DeleteRunbookButton runbookId={runbook.id} />
      </div>
    </div>
  )
}
