import type { Metadata } from 'next'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { WizardShell } from '@/components/onboarding/WizardShell'

export const metadata: Metadata = { title: 'New Client / Service — Command Center' }

export default async function OnboardingPage() {
  // Fetch existing clients and runbooks for "pick existing" selects.
  // requireAdmin() is already called by the admin layout.
  const [clients, runbooks] = await Promise.all([
    clientsRepo.list({ status: 'active', limit: 200 }),
    runbooksRepo.list({ limit: 200 }),
  ])

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    supportPlan: c.supportPlan,
  }))

  const runbookOptions = runbooks.map((r) => ({
    id: r.id,
    title: r.title,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Onboard New Client / Service</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Follow the steps to add a client, their first service, monitoring, and a runbook.
        </p>
      </div>

      <WizardShell clientOptions={clientOptions} runbookOptions={runbookOptions} />
    </div>
  )
}
