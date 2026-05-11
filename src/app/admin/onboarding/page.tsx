import type { Metadata } from 'next'
import { clientsRepo } from '@/lib/repos/clientsRepo'
import { WizardShell } from '@/components/onboarding/WizardShell'

export const metadata: Metadata = { title: 'New Client / Service — Command Center' }

export default async function OnboardingPage() {
  // Fetch existing clients and runbooks for "pick existing" selects.
  // requireAdmin() is already called by the admin layout.
  const clients = await clientsRepo.list({ status: 'active', limit: 200 })

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    supportPlan: c.supportPlan,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Onboard New Client / Service</h1>
        <p className="text-sm text-gray-500 mt-1">
          Follow the steps to add a client, their first service, and monitoring.
        </p>
      </div>

      <WizardShell clientOptions={clientOptions} />
    </div>
  )
}
